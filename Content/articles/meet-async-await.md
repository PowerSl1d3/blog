---
date: 2024-06-14 00:00
description: Краткое содержание доклада Apple Meet async-await.
tags: WWDC, Swift, Async/Await
---
# WWDC21. Meet async-await

## Асинхронные функции с использованием completionHandler-ов

В начале презентации обсуждается асинхронное программирование и его использование.

Приводится пример с функцией `fetchThumbnail`. Эта функция преобразует строку (содержащую ссылку на картинку) в изображение-миниатюру. Эта функция состоит из 4 шагов:

![Fetching a thumbnail](/images/meet-async-await/fetching-a-thumbnail.png)

Какие то из этих шагов выполняются быстро (`thumbnailURLRequest`, `UIImage(data:)`), а какие-то медленно (`dataTask(with:completion:)`, `prepareThumbnail(of:completionHandler)`).

Сама функция на `completionHandler`-ах выглядит следующим образом:

```Swift
func fetchThumbnail(for id: String, completion: @escaping (UIImage?, Error?) -> Void) {
    let request = thumbnailURLRequest(for: id)
    let task = URLSession.shared.dataTask(with: request) { data, response, error in
        if let error = error {
            completion(nil, error)
        } else if (response as? HTTPURLResponse)?.statusCode != 200 {
            completion(nil, FetchError.badID)
        } else {
            guard let image = UIImage(data: data!) else {
                completion(nil, FetchError.badImage)
                return
            }
            image.prepareThumbnail(of: CGSize(width: 40, height: 40)) { thumbnail in
                guard let thumbnail = thumbnail else {
                    completion(nil, FetchError.badImage)
                    return
                }
                completion(thumbnail, nil)
            }
        }
    }
    task.resume()
}
```

Можно заметить, что функция выглядит довольно громоздко и есть много мест, где можно ошибиться и забыть вызвать `completionHandler` в случае обработки ошибок, при этом компилятор Swift нам ничего об этом не подскажет.

Можно переписать функцию выше с использованием типа `Result`:

```Swift
func fetchThumbnail(for id: String, completion: @escaping (Result<UIImage, Error>) -> Void) {
    let request = thumbnailURLRequest(for: id)
    let task = URLSession.shared.dataTask(with: request) { data, response, error in
        if let error = error {
            completion(.failure(error))
        } else if (response as? HTTPURLResponse)?.statusCode != 200 {
            completion(.failure(FetchError.badID))
        } else {
            guard let image = UIImage(data: data!) else {
                completion(.failure(FetchError.badImage))
                return
            }
            image.prepareThumbnail(of: CGSize(width: 40, height: 40)) { thumbnail in
                guard let thumbnail = thumbnail else {
                    completion(.failure(FetchError.badImage))
                    return
                }
                completion(.success(thumbnail))
            }
        }
    }
    task.resume()
}
```

Однако это не сильно улучшает ситуацию.

## Асинхронные функции с использованием async/await

Давайте попробуем взглянуть на ту же функцию но с использованием ключевых слов `async/await`:

```Swift
func fetchThumbnail(for id: String) async throws -> UIImage {
    let request = thumbnailURLRequest(for: id)  
    let (data, response) = try await URLSession.shared.data(for: request)
    guard (response as? HTTPURLResponse)?.statusCode == 200 else { throw FetchError.badID }
    let maybeImage = UIImage(data: data)
    guard let thumbnail = await maybeImage?.thumbnail else { throw FetchError.badImage }
    return thumbnail
}
```

Асинхронными могут быть не только функции, но и `property`, а также инициализаторы:

```Swift
extension UIImage {
    var thumbnail: UIImage? {
        get async {
            let size = CGSize(width: 40, height: 40)
            return await self.byPreparingThumbnail(ofSize: size)
        }
    }
}
```

Стоит отметить, что только `read-only` свойства могут быть асинхронными (также начиная с Swift 5.5 `property getters` могут быть `throws`).

## Вызов асинхронного метода внутри

Обычный вызов синхронной функции выглядит следующим образом:

![A normal function call](/images/meet-async-await/normal-function-call.png)

Вызов асинхронной функции выглядит следующим образом:

![An asynchronous function call](/images/meet-async-await/asynchronous-function-call.png)

Асинхронный метод/функция, встречая ключевое слово `await`, приостанавливает своё выполнение, отдавая контроль над потоком системе. Система может выполнить на этом потоке другую полезную работу, а когда посчитает нужным - продолжить выполнение метода. Стоит отметить, что вызов ключевого слова `await` _не обязательно_ вызывает приостановку работы метода, также как и функция, помеченная ключевым словом `async` _не обязана_ содержать в себе ключевых слов `await`.

Из вышесказанного следует, что выполнение метода/функции при использовании `async/await` не является единой транзакцией.

![The function is not a single transaction](/images/meet-async-await/function-is-not-transaction.png)

В местах, помеченными `await`, состояние функции может измениться кардинальным способом и не нужно делать предположений сделанных относительно предыдущих(функция может приостановить своё выполнение и другие сущности могут изменить своё состояние), которые были до ключевых слов `await`. Более того, функци может продолжить своё выполнение на совершенно другом потоке.

## Несколько важных фактов про async/await

- Когда мы помечаем функцию асинхронной (Помечена `async`), то мы даём ей возможность приостановить своё выполнение. Когда функция приостанавливает своё выполнение - она приостанавливает выполнение вызывавшей её функции. Поэтому вызывающая функция в таком случае тоже должна быть асинхронной (Помечена `async`).
- Ключевое слово `await` обозначает где функция _может_ приостановить своё выполнение (а может и тут же продолжить, каких то гарантий нет). Во время приостановки работы функции может происходить любая другая полезная работа на этом же потоке, который выполнял текущую функцию. Единожды закончившийся ожидаемый вызов функции при помощи `await` продолжает выполнение после этого ключевого слова.

## Адаптирование async/await

### Тестирование асинхронного кода

XCTest поддерживает тестирование асинхронного кода прямо из коробки.

Пример тестирования кода написанного асинхронным способом с использованием `closure` и `XCTestExpectation`:

![Testing asynchronous functions using closure](/images/meet-async-await/async-closure-testing.png)

Пример тестирования кода написанного асинхронным способом с использованием `async/await`:


![Testing asynchronous functions](/images/meet-async-await/async-testing.png)

### Переход от синхронного кода к асинхронному

Как было упомянуто в секции с фактами об `async/await`: асинхронная функция может приостанавливать своё выполнение, значит вызывающая её функция тоже должна быть асинхронной. Но как тогда быть? Как из синхронного контекста вызвать асинхронный?

![Using async in sync context](/images/meet-async-await/async-in-sync-context.png)

В этом случае нам на помощь приходят структуры `Task`. `Task`-и оборачивают вызываемую работу в замыкании и отправляют в систему для немедленного выполнения на следующем свободном потоке (подобно асинхронной функции на `DispatchQueue.global()`).

![Using async in task](/images/meet-async-await/async-in-task.png)

Стоит отметить, что начиная со Swift 5 SDK содержат асинхронные альтернативные методы помимо методов основанных на `completionHandler`-ах.
### Асинхронные альтернативные методы и `continuation`-ы

Предположим, что у нас в приложении имеется имеется следующий метод:

![Core data function](/images/meet-async-await/core-data-function.png)

В нём мы пытаемся асинхронно получить из базы данных записи.

Давайте попробуем адаптировать и создать метод с асинхронным интерфейсом на основе метода с `completionHandler`-ами:

![Core data function adopting async interface](/images/meet-async-await/core-data-function-adopting-async-interface.png)

Однако, на моменте вызова метода с интерфейсом на `completionHandler`-ах, мы приходим к интересной проблеме. Вызывая метод `getPersistentPosts` мы передаем управление этой функции, которая почти тут же закончит свое выполнение и мы не сможем вернуть из метода результат вычислений, поскольку он будет известен только на моменте вызова `completionHandler`-а. То есть нам нужно обозначить момент времени, когда функция должна приостановить своё выполнение и продолжить его только тогда, когда своё выполнение закончит `completionHandeler`.

Взгляните на схему, она вам ничего не напоминает? Будто в ней не хватает одной небольшой детали. До этого мы рассматривали как система обрабатывает вызов асинхронной функции и продолжает её выполнение для нас:

![An asynchronous function call](/images/meet-async-await/asynchronous-function-call.png)

Давайте немного углубимся в то, как работает этот процесс засыпания и продолжения работы метода, а затем перенесём этот опыт на нашу проблему.

Когда мы вызываем асинхронную версию `getPersistantPosts`, она передаёт своё управление `Core Data`.

![Core data function diagram](/images/meet-async-await/core-data-function-diagram.png)

 Которая в свою очередь, после выполнения запроса вызовет `completionHandler` с результатом выполнения и передаст выполнения назад в `getPersistantPosts`.

![Core data function second diagram](/images/meet-async-await/core-data-function-second-diagram.png)

Всё чего нам не хватает это перехода между ожиданием выполнения `completionHalder`-а и возобновления выполнения после завершения работы `fetchRequest`-а из `Core Data`.

Эта закономерность возникает постоянно и имя ей - `Continution`.

Давайте перепишем нашу функцию с использованием такого перехода:

![Core data function continuation](/images/meet-async-await/core-data-function-continuation.png)

### Особенности использование Continutation

- Вызов блока кода помещённого в `Continutaion` является синхронным.
- Вызов `resume` внутри `Continution` в  любом из путей выполнения должен происходить единожды! Иначе может происходить краш приложения.
- Отсутствие вызова `resume` в каком то из случаев не приводит к таким печальным последствиям, но тоже является ошибкой и означает что вызванная работа внутри `Continutaion` никогда не будет завершена. Swift runtime предупредит нас об этом.

### Использование Continutaion для делегатов

Альтернативным способом уведомить вызывающую сторону о том, что был выполнен какой то асинхронный код является использование делегатов.

![Adopting delegates](/images/meet-async-await/adopting-delegates.png)

Для того, чтобы адаптировать этот случай, можно сохранять `Continutaion` в локальную переменную и делать `resume` из методов делегата, когда это потребуется (Помимо этого следует проставлять `nil` в `Continuation`, чтобы случайно не вызывать его повторно).

![Using continuation for adopting delegates](/images/meet-async-await/using-continuation-for-adopting-delegates.png)

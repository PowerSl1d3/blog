//
//  Blog+Script.swift
//
//
//  Created by Oleg Aksenenko on 17.06.2024.
//

import Plot

struct Script: Component {
    private let url: URLRepresentable

    init(url: URLRepresentable) {
        self.url = url
    }

    var body: Component {
        Node<HTML.BodyContext>.script(.src(url))
    }
}

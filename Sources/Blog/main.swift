import Foundation
import Publish
import Plot
import SplashPublishPlugin

struct SwiftBuildBlog: Website {
    enum SectionID: String, WebsiteSectionID {
        case articles
        case about
    }

    struct ItemMetadata: WebsiteItemMetadata {}

    var url = URL(string: "https://powersl1d3.github.io")!
    var name = "$>swift build blog&#95;"
    var description = "Блог про iOS разработку и не только"
    var language: Language { .russian }
    var imagePath: Path? { nil }
}

try SwiftBuildBlog()
    .publish(
        withTheme: .blog,
        deployedUsing: .gitHub("PowerSl1d3/PowerSl1d3.github.io"),
        plugins: [.splash(withClassPrefix: "")]
    )

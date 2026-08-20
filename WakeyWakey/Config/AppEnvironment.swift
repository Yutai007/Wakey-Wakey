import Foundation

enum AppEnvironment {
    static var spotifyClientID: String {
        Bundle.main.object(forInfoDictionaryKey: "SPOTIFY_CLIENT_ID") as? String ?? ""
    }

    static var spotifyRedirectURI: String {
        Bundle.main.object(forInfoDictionaryKey: "SPOTIFY_REDIRECT_URI") as? String ?? ""
    }

    static var spotifyURLScheme: String {
        Bundle.main.object(forInfoDictionaryKey: "SPOTIFY_URL_SCHEME") as? String ?? ""
    }

    static var isSpotifyConfigured: Bool {
        !spotifyClientID.isEmpty && !spotifyRedirectURI.isEmpty && !spotifyURLScheme.isEmpty
    }
}

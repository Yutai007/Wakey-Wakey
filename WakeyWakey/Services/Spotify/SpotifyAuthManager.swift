import Foundation
import SpotifyiOS

@MainActor
final class SpotifyAuthManager: NSObject, ObservableObject {
    static let shared = SpotifyAuthManager()

    @Published private(set) var isAuthorized = false
    @Published private(set) var lastErrorMessage: String?

    private let tokenKey = "spotify_access_token"

    private(set) lazy var configuration: SPTConfiguration = {
        SPTConfiguration(
            clientID: AppEnvironment.spotifyClientID,
            redirectURL: URL(string: AppEnvironment.spotifyRedirectURI)!
        )
    }()

    private(set) lazy var appRemote: SPTAppRemote = {
        let remote = SPTAppRemote(configuration: configuration, logLevel: .debug)
        if let token = KeychainStore.read(tokenKey) {
            remote.connectionParameters.accessToken = token
            isAuthorized = true
        }
        return remote
    }()

    private override init() {
        super.init()
    }

    func authorize() {
        guard AppEnvironment.isSpotifyConfigured else {
            lastErrorMessage = "Spotify is not configured. Add values to SpotifySecrets.xcconfig."
            return
        }

        let didOpenSpotify = appRemote.authorizeAndPlayURI("")
        if !didOpenSpotify {
            lastErrorMessage = "Spotify app is not installed on this device."
        }
    }

    func handleRedirectURL(_ url: URL) {
        guard let parameters = appRemote.authorizationParameters(from: url) else {
            return
        }

        if let accessToken = parameters[SPTAppRemoteAccessTokenKey] {
            appRemote.connectionParameters.accessToken = accessToken
            _ = KeychainStore.save(accessToken, for: tokenKey)
            isAuthorized = true
            lastErrorMessage = nil
        } else if let errorDescription = parameters[SPTAppRemoteErrorDescriptionKey] {
            isAuthorized = false
            lastErrorMessage = "Spotify authorization failed: \(errorDescription)"
        }
    }

    func logout() {
        appRemote.connectionParameters.accessToken = nil
        _ = KeychainStore.delete(tokenKey)
        isAuthorized = false
    }
}

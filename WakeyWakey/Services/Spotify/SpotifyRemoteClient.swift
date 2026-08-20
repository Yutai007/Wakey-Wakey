import Foundation
import SpotifyiOS

@MainActor
final class SpotifyRemoteClient: NSObject, ObservableObject {
    static let shared = SpotifyRemoteClient()

    @Published private(set) var connectionState = "Disconnected"
    @Published private(set) var nowPlaying: String?

    private let auth = SpotifyAuthManager.shared

    private override init() {
        super.init()
        auth.appRemote.delegate = self
    }

    func connectIfPossible() {
        guard auth.isAuthorized else {
            connectionState = "Not authorized"
            return
        }

        if !auth.appRemote.isConnected {
            auth.appRemote.connect()
            connectionState = "Connecting"
        }
    }

    func disconnect() {
        auth.appRemote.disconnect()
        connectionState = "Disconnected"
    }

    func playTrack(uri: String) {
        connectIfPossible()
        auth.appRemote.playerAPI?.play(uri, callback: { [weak self] _, error in
            if let error {
                self?.connectionState = "Playback failed: \(error.localizedDescription)"
            } else {
                self?.connectionState = "Playing"
            }
        })
    }

    func refreshPlayerState() {
        auth.appRemote.playerAPI?.getPlayerState({ [weak self] result, error in
            guard error == nil else {
                self?.nowPlaying = nil
                return
            }
            guard let state = result as? SPTAppRemotePlayerState else {
                return
            }
            self?.nowPlaying = state.track.name
        })
    }
}

extension SpotifyRemoteClient: SPTAppRemoteDelegate {
    func appRemoteDidEstablishConnection(_ appRemote: SPTAppRemote) {
        connectionState = "Connected"
        appRemote.playerAPI?.delegate = self
        appRemote.playerAPI?.subscribe(toPlayerState: { _, _ in })
    }

    func appRemote(_ appRemote: SPTAppRemote, didFailConnectionAttemptWithError error: Error?) {
        connectionState = "Connection failed: \(error?.localizedDescription ?? "unknown error")"
    }

    func appRemote(_ appRemote: SPTAppRemote, didDisconnectWithError error: Error?) {
        connectionState = "Disconnected"
    }
}

extension SpotifyRemoteClient: SPTAppRemotePlayerStateDelegate {
    func playerStateDidChange(_ playerState: SPTAppRemotePlayerState) {
        nowPlaying = playerState.track.name
    }
}

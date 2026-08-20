import SwiftUI

@main
struct WakeyWakeyApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate

    @StateObject private var alarmListViewModel = AlarmListViewModel()
    @StateObject private var spotifyAuth = SpotifyAuthManager.shared
    @StateObject private var spotifyRemote = SpotifyRemoteClient.shared

    var body: some Scene {
        WindowGroup {
            AlarmListView(viewModel: alarmListViewModel)
                .environmentObject(spotifyAuth)
                .environmentObject(spotifyRemote)
                .task {
                    do {
                        try await AlarmScheduler.requestPermissions()
                    } catch {
                        print("Notification permission request failed: \(error.localizedDescription)")
                    }
                }
                .onReceive(NotificationCenter.default.publisher(for: AlarmScheduler.didTapAlarmNotification)) { output in
                    guard let trackURI = output.userInfo?["trackURI"] as? String else {
                        return
                    }

                    spotifyRemote.playTrack(uri: trackURI)
                }
        }
    }
}

import SwiftUI

struct AlarmListView: View {
    @ObservedObject var viewModel: AlarmListViewModel
    @EnvironmentObject private var spotifyAuth: SpotifyAuthManager
    @EnvironmentObject private var spotifyRemote: SpotifyRemoteClient

    @State private var isShowingNewAlarmSheet = false

    var body: some View {
        NavigationStack {
            List {
                Section("Spotify") {
                    if spotifyAuth.isAuthorized {
                        Text("Connected")
                        Text("State: \(spotifyRemote.connectionState)")
                            .font(.footnote)
                            .foregroundStyle(.secondary)

                        if let nowPlaying = spotifyRemote.nowPlaying {
                            Text("Now Playing: \(nowPlaying)")
                                .font(.footnote)
                        }

                        Button("Refresh Player State") {
                            spotifyRemote.refreshPlayerState()
                        }

                        Button("Disconnect Spotify") {
                            spotifyAuth.logout()
                            spotifyRemote.disconnect()
                        }
                        .foregroundStyle(.red)
                    } else {
                        Text("Spotify is not connected")
                            .foregroundStyle(.secondary)

                        if let error = spotifyAuth.lastErrorMessage {
                            Text(error)
                                .font(.footnote)
                                .foregroundStyle(.red)
                        }

                        Button("Connect Spotify") {
                            spotifyAuth.authorize()
                        }
                    }
                }

                Section("Alarms") {
                    if viewModel.alarms.isEmpty {
                        Text("No alarms yet")
                            .foregroundStyle(.secondary)
                    } else {
                        ForEach(viewModel.alarms) { alarm in
                            HStack {
                                VStack(alignment: .leading, spacing: 4) {
                                    Text(alarm.displayTime)
                                        .font(.headline)
                                    Text(alarm.label)
                                        .font(.subheadline)
                                        .foregroundStyle(.secondary)
                                    Text(alarm.trackURI)
                                        .font(.caption)
                                        .lineLimit(1)
                                        .foregroundStyle(.secondary)
                                }
                                Spacer()
                                Toggle("", isOn: Binding(
                                    get: { alarm.isEnabled },
                                    set: { _ in
                                        viewModel.toggleEnabled(for: alarm)
                                    }
                                ))
                                .labelsHidden()
                            }
                        }
                        .onDelete(perform: viewModel.deleteAlarms)
                    }
                }
            }
            .navigationTitle("Wakey Wakey")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        isShowingNewAlarmSheet = true
                    } label: {
                        Image(systemName: "plus")
                    }
                }
            }
            .sheet(isPresented: $isShowingNewAlarmSheet) {
                AlarmEditorView { hour, minute, trackURI, label in
                    viewModel.addAlarm(hour: hour, minute: minute, trackURI: trackURI, label: label)
                }
            }
        }
    }
}

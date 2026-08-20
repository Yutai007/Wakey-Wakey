import Foundation

@MainActor
final class AlarmListViewModel: ObservableObject {
    @Published private(set) var alarms: [Alarm] = []

    private let storageKey = "wakeywakey_alarms"

    init() {
        load()
    }

    func addAlarm(hour: Int, minute: Int, trackURI: String, label: String) {
        let newAlarm = Alarm(hour: hour, minute: minute, trackURI: trackURI, label: label)
        alarms.append(newAlarm)
        persistAndReschedule()
    }

    func updateAlarm(_ alarm: Alarm) {
        guard let index = alarms.firstIndex(where: { $0.id == alarm.id }) else {
            return
        }

        alarms[index] = alarm
        persistAndReschedule()
    }

    func deleteAlarms(at offsets: IndexSet) {
        alarms.remove(atOffsets: offsets)
        persistAndReschedule()
    }

    func toggleEnabled(for alarm: Alarm) {
        guard let index = alarms.firstIndex(where: { $0.id == alarm.id }) else {
            return
        }

        alarms[index].isEnabled.toggle()
        persistAndReschedule()
    }

    private func load() {
        guard let data = UserDefaults.standard.data(forKey: storageKey) else {
            return
        }

        do {
            alarms = try JSONDecoder().decode([Alarm].self, from: data)
        } catch {
            print("Failed to decode alarms: \(error.localizedDescription)")
        }
    }

    private func persistAndReschedule() {
        do {
            let data = try JSONEncoder().encode(alarms)
            UserDefaults.standard.set(data, forKey: storageKey)
        } catch {
            print("Failed to encode alarms: \(error.localizedDescription)")
        }

        Task {
            await AlarmScheduler.rescheduleAll(alarms)
        }
    }
}

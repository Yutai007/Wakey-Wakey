import Foundation
import UserNotifications

enum AlarmScheduler {
    static let didTapAlarmNotification = Notification.Name("didTapAlarmNotification")

    static func requestPermissions() async throws {
        try await UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .badge])
    }

    static func rescheduleAll(_ alarms: [Alarm]) async {
        let center = UNUserNotificationCenter.current()
        center.removeAllPendingNotificationRequests()

        for alarm in alarms where alarm.isEnabled {
            let content = UNMutableNotificationContent()
            content.title = alarm.label.isEmpty ? "Alarm" : alarm.label
            content.body = "Tap to launch Spotify wake-up track"
            content.sound = .default
            content.userInfo = [
                "alarmId": alarm.id.uuidString,
                "trackURI": alarm.trackURI
            ]

            var components = DateComponents()
            components.hour = alarm.hour
            components.minute = alarm.minute

            let trigger = UNCalendarNotificationTrigger(dateMatching: components, repeats: true)
            let request = UNNotificationRequest(
                identifier: alarm.id.uuidString,
                content: content,
                trigger: trigger
            )

            do {
                try await center.add(request)
            } catch {
                print("Failed to schedule alarm: \(error.localizedDescription)")
            }
        }
    }
}

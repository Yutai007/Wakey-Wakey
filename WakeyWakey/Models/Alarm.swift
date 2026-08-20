import Foundation

struct Alarm: Identifiable, Codable, Equatable {
    let id: UUID
    var hour: Int
    var minute: Int
    var trackURI: String
    var label: String
    var isEnabled: Bool

    init(
        id: UUID = UUID(),
        hour: Int,
        minute: Int,
        trackURI: String,
        label: String,
        isEnabled: Bool = true
    ) {
        self.id = id
        self.hour = hour
        self.minute = minute
        self.trackURI = trackURI
        self.label = label
        self.isEnabled = isEnabled
    }

    var displayTime: String {
        let formatter = DateFormatter()
        formatter.locale = Locale.current
        formatter.dateFormat = "h:mm a"
        var components = DateComponents()
        components.hour = hour
        components.minute = minute
        let date = Calendar.current.date(from: components) ?? Date()
        return formatter.string(from: date)
    }
}

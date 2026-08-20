import SwiftUI

struct AlarmEditorView: View {
    @Environment(\.dismiss) private var dismiss

    @State private var date = Date()
    @State private var trackURI = "spotify:track:69bp2EbF7Q2rqc5N3ylezZ"
    @State private var label = "Wake up"

    let onSave: (_ hour: Int, _ minute: Int, _ trackURI: String, _ label: String) -> Void

    var body: some View {
        NavigationStack {
            Form {
                DatePicker("Time", selection: $date, displayedComponents: .hourAndMinute)

                TextField("Spotify track URI", text: $trackURI)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()

                TextField("Label", text: $label)
            }
            .navigationTitle("New Alarm")
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Cancel") {
                        dismiss()
                    }
                }

                ToolbarItem(placement: .topBarTrailing) {
                    Button("Save") {
                        let components = Calendar.current.dateComponents([.hour, .minute], from: date)
                        let hour = components.hour ?? 7
                        let minute = components.minute ?? 0
                        onSave(hour, minute, trackURI, label)
                        dismiss()
                    }
                    .disabled(trackURI.isEmpty)
                }
            }
        }
    }
}

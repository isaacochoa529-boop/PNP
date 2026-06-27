import sys
import os
import pretty_midi


NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]


def midi_number_to_name(number):
    octave = (number // 12) - 1
    name = NOTE_NAMES[number % 12]
    return f"{name}{octave}"


def safe_filename(name):
    return "".join(c.lower() if c.isalnum() else "_" for c in name).strip("_")


def describe_track(index, instrument):
    if instrument.is_drum:
        instrument_name = "Drums"
    else:
        instrument_name = pretty_midi.program_to_instrument_name(instrument.program)

    if not instrument.notes:
        return f"[{index}] {instrument_name} | 0 notes"

    lowest = min(note.pitch for note in instrument.notes)
    highest = max(note.pitch for note in instrument.notes)
    start = min(note.start for note in instrument.notes)
    end = max(note.end for note in instrument.notes)

    return (
        f"[{index}] {instrument_name} | "
        f"{len(instrument.notes)} notes | "
        f"{midi_number_to_name(lowest)}-{midi_number_to_name(highest)} | "
        f"{start:.2f}s-{end:.2f}s"
    )


def list_tracks(midi_data):
    print("\nAvailable Tracks:\n")

    for i, instrument in enumerate(midi_data.instruments):
        print(describe_track(i, instrument))

    print()

def export_track_previews(midi_data, output_name):
    preview_folder = "track_previews"
    os.makedirs(preview_folder, exist_ok=True)

    for i, instrument in enumerate(midi_data.instruments):
        if instrument.is_drum or not instrument.notes:
            continue

        preview_midi = pretty_midi.PrettyMIDI()

        preview_instrument = pretty_midi.Instrument(
            program=instrument.program,
            name=f"Track {i}"
        )

        for note in instrument.notes:
            preview_instrument.notes.append(note)

        preview_midi.instruments.append(preview_instrument)

        preview_file = os.path.join(
            preview_folder,
            f"{safe_filename(output_name)}_track_{i}_preview.mid"
        )

        preview_midi.write(preview_file)
        print(f"Preview saved: {preview_file}")

def convert_track_to_chart(midi_path, output_name="converted_song"):
    midi_data = pretty_midi.PrettyMIDI(midi_path)

    list_tracks(midi_data)
    
    export_track_previews(midi_data, output_name)
    print("\nOpen the files in track_previews to hear each track before choosing.\n")

    track_index = int(input("Track to convert: "))
    instrument = midi_data.instruments[track_index]

    chart_notes = []

    for note in instrument.notes:
        chart_notes.append({
            "note": midi_number_to_name(note.pitch),
            "time": note.start,
            "duration": note.end - note.start,
            "velocity": note.velocity,
        })

    chart_notes.sort(key=lambda n: n["time"])

    if not chart_notes:
        print("No notes found in that track.")
        return

    first_time = chart_notes[0]["time"]

    for note in chart_notes:
        note["time"] = note["time"] - first_time

    output_file = os.path.join("songs", f"{safe_filename(output_name)}_track_{track_index}.py")

    with open(output_file, "w", encoding="utf-8") as f:
        f.write(f'TITLE = "{output_name} Track {track_index}"\n')
        f.write('ARTIST = "Unknown"\n')
        f.write("DIFFICULTY = 1\n")
        f.write("BPM = 120\n\n")
        f.write("CHART = [\n")

        for note in chart_notes:
            f.write(
                f'    {{"note": "{note["note"]}", '
                f'"time": {note["time"]:.3f}, '
                f'"duration": {note["duration"]:.3f}, '
                f'"velocity": {note["velocity"]}}},\n'
            )

        f.write("]\n")

    print(f"\nConverted track {track_index} with {len(chart_notes)} notes.")
    print(f"Saved to {output_file}")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: py -3.12 midi_converter.py your_song.mid")
        sys.exit()

    midi_path = sys.argv[1]
    output_name = os.path.splitext(os.path.basename(midi_path))[0]

    convert_track_to_chart(midi_path, output_name)
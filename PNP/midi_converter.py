import argparse
import json
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

def get_bpm(midi_data):
    _, tempos = midi_data.get_tempo_changes()
    if len(tempos):
        bpm = round(float(tempos[0]), 2)
        return int(bpm) if bpm.is_integer() else bpm
    return 120


def instrument_name(instrument):
    if instrument.is_drum:
        return "Drums"
    return pretty_midi.program_to_instrument_name(instrument.program)


def build_chart_notes(instrument):
    chart_notes = []

    for note in instrument.notes:
        chart_notes.append({
            "note": midi_number_to_name(note.pitch),
            "midi": note.pitch,
            "time": note.start,
            "duration": note.end - note.start,
            "velocity": note.velocity,
        })

    chart_notes.sort(key=lambda n: (n["time"], n["midi"]))

    if chart_notes:
        first_time = chart_notes[0]["time"]
        for note in chart_notes:
            note["time"] = note["time"] - first_time

    return chart_notes


def write_py_chart(chart_notes, output_name, track_index, bpm):
    output_file = os.path.join("songs", f"{safe_filename(output_name)}_track_{track_index}.py")

    with open(output_file, "w", encoding="utf-8") as f:
        f.write(f'TITLE = "{output_name} Track {track_index}"\n')
        f.write('ARTIST = "Unknown"\n')
        f.write("DIFFICULTY = 1\n")
        f.write(f"BPM = {bpm}\n\n")
        f.write("CHART = [\n")

        for note in chart_notes:
            f.write(
                f'    {{"note": "{note["note"]}", '
                f'"time": {note["time"]:.3f}, '
                f'"duration": {note["duration"]:.3f}, '
                f'"velocity": {note["velocity"]}}},\n'
            )

        f.write("]\n")

    return output_file


def write_json_chart(chart_notes, output_name, track_index, bpm, instrument, midi_path):
    """Write a chart a browser game can load with fetch(...).then(r => r.json())."""
    json_folder = os.path.join("songs", "json")
    os.makedirs(json_folder, exist_ok=True)
    output_file = os.path.join(json_folder, f"{safe_filename(output_name)}_track_{track_index}.json")

    notes = [
        {
            "note": n["note"],
            "midi": n["midi"],
            "time": round(n["time"], 3),
            "duration": round(n["duration"], 3),
            "velocity": n["velocity"],
        }
        for n in chart_notes
    ]
    pitches = [n["midi"] for n in notes]
    length = max(n["time"] + n["duration"] for n in notes)

    chart = {
        "format": "pnp-chart",
        "version": 1,
        "title": f"{output_name} Track {track_index}",
        "artist": "Unknown",
        "difficulty": 1,
        "bpm": bpm,
        "source": os.path.basename(midi_path),
        "track": track_index,
        "instrument": instrument_name(instrument),
        "noteCount": len(notes),
        "length": round(length, 3),
        "range": {
            "low": midi_number_to_name(min(pitches)),
            "high": midi_number_to_name(max(pitches)),
            "lowMidi": min(pitches),
            "highMidi": max(pitches),
        },
        "notes": notes,
    }

    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(chart, f, indent=2)
        f.write("\n")

    return output_file


def convert_track_to_chart(midi_path, output_name="converted_song", track_index=None,
                           formats=("py",), previews=True):
    midi_data = pretty_midi.PrettyMIDI(midi_path)
    bpm = get_bpm(midi_data)

    if track_index is None:
        list_tracks(midi_data)
        if previews:
            export_track_previews(midi_data, output_name)
            print("\nOpen the files in track_previews to hear each track before choosing.\n")
        track_index = int(input("Track to convert: "))

    instrument = midi_data.instruments[track_index]
    chart_notes = build_chart_notes(instrument)

    if not chart_notes:
        print(f"No notes found in track {track_index}.")
        return []

    saved = []
    if "py" in formats:
        saved.append(write_py_chart(chart_notes, output_name, track_index, bpm))
    if "json" in formats:
        saved.append(write_json_chart(chart_notes, output_name, track_index, bpm, instrument, midi_path))

    print(f"\nConverted track {track_index} with {len(chart_notes)} notes.")
    for path in saved:
        print(f"Saved to {path}")

    return saved


def main():
    parser = argparse.ArgumentParser(description="Convert a MIDI track into a PNP note chart.")
    parser.add_argument("midi_path", help="the .mid file to convert")
    parser.add_argument("--track", help="track number to convert, or 'all' (skips the prompt)")
    parser.add_argument("--format", choices=["py", "json", "both"], default="py",
                        help="py = pygame chart (default), json = browser game chart, both = each")
    parser.add_argument("--no-previews", action="store_true", help="don't write track preview MIDIs")
    args = parser.parse_args()

    output_name = os.path.splitext(os.path.basename(args.midi_path))[0]
    formats = ("py", "json") if args.format == "both" else (args.format,)
    previews = not args.no_previews

    if args.track == "all":
        midi_data = pretty_midi.PrettyMIDI(args.midi_path)
        tracks = [i for i, inst in enumerate(midi_data.instruments) if inst.notes and not inst.is_drum]
        for i in tracks:
            convert_track_to_chart(args.midi_path, output_name, i, formats, previews)
    else:
        track_index = int(args.track) if args.track is not None else None
        convert_track_to_chart(args.midi_path, output_name, track_index, formats, previews)


if __name__ == "__main__":
    main()

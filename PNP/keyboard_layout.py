from settings import *

NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]


def note_name_to_number(note_name):
    if "#" in note_name:
        name = note_name[:2]
        octave = int(note_name[2:])
    else:
        name = note_name[:1]
        octave = int(note_name[1:])

    return (octave + 1) * 12 + NOTE_NAMES.index(name)


def number_to_note_name(number):
    octave = (number // 12) - 1
    name = NOTE_NAMES[number % 12]
    return f"{name}{octave}"


def is_black_key(note_name):
    return "#" in note_name


def build_keyboard_layout(chart):
    used_numbers = [note_name_to_number(item["note"]) for item in chart]

    lowest = min(used_numbers)
    highest = max(used_numbers)

    keyboard_notes = [
        number_to_note_name(number)
        for number in range(lowest, highest + 1)
    ]

    note_to_key = {
        note_name: i
        for i, note_name in enumerate(keyboard_notes)
    }

    white_notes = [
        note_name for note_name in keyboard_notes
        if not is_black_key(note_name)
    ]

    white_key_width = max(42, (WIDTH - 260) // len(white_notes))
    black_key_width = int(white_key_width * BLACK_KEY_WIDTH_RATIO)

    total_white_width = white_key_width * len(white_notes)
    start_x = (WIDTH - total_white_width) // 2

    key_positions = [0 for _ in keyboard_notes]
    key_widths = [0 for _ in keyboard_notes]

    white_index = 0
    last_white_x = start_x

    for i, note_name in enumerate(keyboard_notes):
        if not is_black_key(note_name):
            x = start_x + white_index * white_key_width

            key_positions[i] = x
            key_widths[i] = white_key_width - KEY_GAP

            last_white_x = x
            white_index += 1
        else:
            x = last_white_x + white_key_width - black_key_width // 2

            key_positions[i] = x
            key_widths[i] = black_key_width

    return keyboard_notes, note_to_key, key_positions, key_widths
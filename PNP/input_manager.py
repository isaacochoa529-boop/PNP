import pygame.midi


NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]


def midi_number_to_name(number):
    octave = (number // 12) - 1
    name = NOTE_NAMES[number % 12]
    return f"{name}{octave}"


class InputManager:
    def __init__(self):
        pygame.midi.init()
        self.midi_input = None
        self.midi_enabled = False
        self.connect_midi()

    def connect_midi(self):
        if self.midi_input is not None:
            self.midi_input.close()
            self.midi_input = None

        self.midi_enabled = False

        for i in range(pygame.midi.get_count()):
            info = pygame.midi.get_device_info(i)
            name = info[1].decode()
            is_input = info[2]

            if is_input:
                self.midi_input = pygame.midi.Input(i)
                self.midi_enabled = True
                print(f"MIDI connected: {name}")
                return

        print("No MIDI input found. Keyboard mode only.")

    def get_midi_key_presses(self, note_to_key):
        key_presses = []

        if not self.midi_enabled:
            return key_presses

        if self.midi_input.poll():
            events = self.midi_input.read(50)

            for event in events:
                data = event[0]
                status = data[0]
                note_number = data[1]
                velocity = data[2]

                is_note_on = status == 144 and velocity > 0

                if is_note_on:
                    note_name = midi_number_to_name(note_number)

                    if note_name in note_to_key:
                        key_presses.append(note_to_key[note_name])

        return key_presses

    def close(self):
        if self.midi_input is not None:
            self.midi_input.close()

        pygame.midi.quit()
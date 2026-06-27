from song_loader import load_song_list
import pygame
import sys


from settings import *
from note import Note
from input_manager import InputManager
from renderer import Renderer
from keyboard_layout import build_keyboard_layout
from screens import draw_start_screen, draw_calibration_screen


class Game:
    def __init__(self):
        pygame.init()

        self.input_manager = InputManager()
        self.renderer = Renderer()

        self.screen = pygame.display.set_mode((WIDTH, HEIGHT))
        pygame.display.set_caption(TITLE)

        self.clock = pygame.time.Clock()
        self.font = pygame.font.SysFont(None, 36)
        self.big_font = pygame.font.SysFont(None, 64)
        self.small_font = pygame.font.SysFont(None, 28)

        self.songs = load_song_list()
        self.selected_song_index = 0
        self.current_song = self.songs[self.selected_song_index]
        self.chart = self.current_song["chart"]

        self.keyboard_notes, self.note_to_key, self.key_positions, self.key_widths = build_keyboard_layout(self.chart)

        self.key_flash = [0 for _ in self.keyboard_notes]

        self.debug_keys = [
            pygame.K_a,
            pygame.K_s,
            pygame.K_d,
            pygame.K_f,
            pygame.K_j,
            pygame.K_k,
            pygame.K_l,
            pygame.K_SEMICOLON,
        ]

        self.mode = "start"
        self.paused = False
        self.restart_countdown = 0
        self.practice_tempo = 0.40
        
        self.play_mode = "practice"
        self.learn_index = 0
        self.learn_visible_count = 5

        self.calibration_notes = []

        for item in self.chart:
            if item["note"] not in self.calibration_notes:
                self.calibration_notes.append(item["note"])

        self.calibration_index = 0
        self.calibration_message = "Press each song key once."

        self.reset_stats()
        self.reset_chart()

        self.running = True

    def reset_stats(self):
        self.score = 0
        self.hits = 0
        self.misses = 0
        self.combo = 0
        self.max_combo = 0
        self.perfects = 0
        self.greats = 0
        self.oks = 0
        self.early_hits = 0
        self.late_hits = 0
        self.total_signed_error = 0

        self.feedback_text = ""
        self.feedback_color = WHITE
        self.feedback_timer = 0
        self.feedback_streak = 0
        self.feedback_timing = ""

    def reset_chart(self):
        self.notes = []

        for item in self.chart:
            if item["note"] not in self.note_to_key:
                continue

            key_index = self.note_to_key[item["note"]]
            spawn_y = -100 - (item["time"] * BEAT_SPACING)

            self.notes.append(Note(key_index, spawn_y))

    def run(self):
        while self.running:
            self.handle_events()
            self.update()
            self.draw()

        self.input_manager.close()
        pygame.quit()
        sys.exit()

    def handle_events(self):
        for event in pygame.event.get():

            if event.type == pygame.QUIT:
                self.running = False

            if event.type == pygame.KEYDOWN:

                if event.key == pygame.K_ESCAPE:
                    self.running = False

                if event.key == pygame.K_m:
                    self.input_manager.connect_midi()

                if self.mode == "start":
                    self.handle_start_events(event)

                elif self.mode == "calibration":
                    self.handle_calibration_events(event)

                elif self.mode == "playing":
                    self.handle_playing_events(event)

    def handle_start_events(self, event):
        if event.key == pygame.K_w:
           self.toggle_play_mode()

        if event.key == pygame.K_s:
            self.toggle_play_mode()

        if event.key == pygame.K_a or event.key == pygame.K_LEFT:
               self.selected_song_index = (self.selected_song_index - 1) % len(self.songs)
               self.load_selected_song()

        if event.key == pygame.K_d or event.key == pygame.K_RIGHT:
            self.selected_song_index = (self.selected_song_index + 1) % len(self.songs)
            self.load_selected_song()

        if event.key == pygame.K_UP:
            self.practice_tempo = min(1.0, self.practice_tempo + 0.10)

        if event.key == pygame.K_DOWN:
            self.practice_tempo = max(0.10, self.practice_tempo - 0.10)

        if event.key == pygame.K_RETURN:
            self.mode = "calibration"
            self.calibration_index = 0
            self.calibration_message = "Press each song key once."

    def handle_calibration_events(self, event):
        if event.key == pygame.K_RETURN:
            self.start_song()

        if event.key in self.debug_keys:
            pressed_key = self.debug_keys.index(event.key)

            if pressed_key < len(self.keyboard_notes):
                self.process_calibration_press(pressed_key)

    def handle_playing_events(self, event):
        if event.key == pygame.K_SPACE:
            self.debug_press_next_note()

        if event.key == pygame.K_p:
            self.paused = not self.paused

        if event.key == pygame.K_r:
            self.reset_stats()
            self.reset_chart()
            self.restart_countdown = 0
            self.mode = "start"

        if not self.paused and event.key in self.debug_keys:
            pressed_key = self.debug_keys.index(event.key)

            if pressed_key < len(self.keyboard_notes):
                self.process_key_press(pressed_key)

    def align_learn_view(self):
        if self.learn_index >= len(self.notes):
            return

        target_note = self.notes[self.learn_index]
        offset = HIT_LINE_Y - target_note.center_y()

        for note in self.notes:
            note.y += offset

    def start_song(self):
        self.reset_stats()
        self.reset_chart()
        self.restart_countdown = 0
        self.paused = False
        self.mode = "playing"
        if self.play_mode == "learn":
           self.align_learn_view()

    def process_calibration_press(self, pressed_key):
        self.key_flash[pressed_key] = 10

        if self.calibration_index >= len(self.calibration_notes):
            return

        needed_note = self.calibration_notes[self.calibration_index]
        needed_key = self.note_to_key[needed_note]

        if pressed_key == needed_key:
            self.calibration_index += 1

            if self.calibration_index >= len(self.calibration_notes):
                self.calibration_message = "Calibration complete! Press Enter to start."
            else:
                self.calibration_message = "Good!"
        else:
            pressed_label = self.keyboard_notes[pressed_key]
            self.calibration_message = f"That was {pressed_label}. Need {needed_note}."

    def debug_press_next_note(self):
        if self.play_mode == "learn":
            if self.learn_index >= len(self.notes):
                return

            next_note = self.notes[self.learn_index]
            self.process_key_press(next_note.lane)
            return

        for note in self.notes:
            if not note.hit:
                self.process_key_press(note.lane)
                return

    def process_key_press(self, pressed_key):
        self.key_flash[pressed_key] = 10
        self.handle_key_press(pressed_key)

    def handle_key_press(self, pressed_key):
        hit_any_note = False
        if self.play_mode == "learn":
           self.handle_learn_key_press(pressed_key)
           return
            
        for note in self.notes:
            if note.hit:
                continue

            if note.lane != pressed_key:
                continue

            signed_error = note.center_y() - HIT_LINE_Y
            timing_error = abs(signed_error)

            if timing_error <= HIT_WINDOW:
                self.register_hit(note, timing_error, signed_error)
                hit_any_note = True
                break

        if not hit_any_note:
            self.register_miss()

    def register_hit(self, note, timing_error, signed_error):
        self.hits += 1
        self.combo += 1
        self.max_combo = max(self.max_combo, self.combo)
        self.total_signed_error += signed_error

        note.hit = True

        if signed_error < -8:
            timing_text = "EARLY"
            self.early_hits += 1
        elif signed_error > 8:
            timing_text = "LATE"
            self.late_hits += 1
        else:
            timing_text = "ON TIME"

        if timing_error <= PERFECT_WINDOW:
            self.score += 300
            self.perfects += 1
            self.feedback_text = "PERFECT!"
            self.feedback_color = PERFECT_COLOR
        elif timing_error <= GREAT_WINDOW:
            self.score += 200
            self.greats += 1
            self.feedback_text = "GREAT!"
            self.feedback_color = GREAT_COLOR
        else:
            self.score += 100
            self.oks += 1
            self.feedback_text = "OK!"
            self.feedback_color = OK_COLOR

        self.feedback_timer = 50
        self.feedback_streak = self.combo
        self.feedback_timing = timing_text

    def register_miss(self):
        self.misses += 1
        self.combo = 0
        self.feedback_text = "MISS!"
        self.feedback_color = MISS_COLOR
        self.feedback_timer = 50
        self.feedback_streak = 0
        self.feedback_timing = ""

    def update(self):
        midi_key_presses = self.input_manager.get_midi_key_presses(self.note_to_key)

        for pressed_key in midi_key_presses:
            if self.mode == "calibration":
                self.process_calibration_press(pressed_key)
            elif self.mode == "playing" and not self.paused:
                self.process_key_press(pressed_key)

        for i in range(len(self.key_flash)):
            if self.key_flash[i] > 0:
                self.key_flash[i] -= 1

        if self.feedback_timer > 0:
            self.feedback_timer -= 1

        if self.mode != "playing":
            return

        if self.paused:
            return

        if self.restart_countdown > 0:
            self.restart_countdown -= 1

            if self.restart_countdown == 0:
                self.reset_chart()

            return
        
        if self.play_mode == "learn":
           return

        for note in self.notes:
            if not note.hit:
                note.move(NOTE_SPEED * self.practice_tempo)

                if note.y > HEIGHT:
                    note.hit = True
                    self.register_miss()

        if all(note.hit for note in self.notes):
            self.restart_countdown = 90

    def handle_learn_key_press(self, pressed_key):
        if self.learn_index >= len(self.notes):
            return

        current_note = self.notes[self.learn_index]

        if pressed_key == current_note.lane:
            current_note.hit = True
            self.register_hit(current_note, 0, 0)
            self.learn_index += 1
            self.align_learn_view()
        else:
            self.register_miss()

    def toggle_play_mode(self):
        if self.play_mode == "practice":
            self.play_mode = "learn"
        else:
            self.play_mode = "practice"

        self.reset_stats()
        self.reset_chart()
        self.learn_index = 0

    def load_selected_song(self):
        self.current_song = self.songs[self.selected_song_index]
        self.chart = self.current_song["chart"]

        self.keyboard_notes, self.note_to_key, self.key_positions, self.key_widths = build_keyboard_layout(self.chart)
        self.key_flash = [0 for _ in self.keyboard_notes]

        self.calibration_notes = []

        for item in self.chart:
            if item["note"] not in self.calibration_notes:
                self.calibration_notes.append(item["note"])

        self.calibration_index = 0
        self.calibration_message = "Press each song key once."

        self.reset_stats()
        self.reset_chart()
    
    def draw(self):
        self.renderer.draw(self.screen, self)

        if self.mode == "start":
            draw_start_screen(self)

        if self.mode == "calibration":
            draw_calibration_screen(self)

        pygame.display.flip()
        self.clock.tick(FPS)

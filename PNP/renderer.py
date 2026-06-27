import pygame
from settings import *


class Renderer:
    def __init__(self):
        self.font = pygame.font.SysFont(None, 36)
        self.big_font = pygame.font.SysFont(None, 60)
        self.small_font = pygame.font.SysFont(None, 28)

    def draw(self, screen, game):
        screen.fill(BACKGROUND)
        self.draw_piano_keys(screen, game)
        self.draw_notes(screen, game)
        self.draw_ui(screen, game)

    def draw_piano_keys(self, screen, game):
        piano_top_y = HIT_LINE_Y + 10
        piano_height = HEIGHT - piano_top_y

        for i, note_name in enumerate(game.keyboard_notes):
            key_x = game.key_positions[i]
            key_width = game.key_widths[i]

            if "#" in note_name:
                continue

            lane_color = (45, 45, 60)
            if game.key_flash[i] > 0:
                lane_color = (80, 80, 120)

            pygame.draw.rect(screen, lane_color, (key_x, 0, key_width, HIT_LINE_Y))
            pygame.draw.line(screen, WHITE, (key_x, HIT_LINE_Y), (key_x + key_width, HIT_LINE_Y), 3)

            key_color = (245, 245, 245)
            if game.key_flash[i] > 0:
                key_color = (255, 230, 120)

            pygame.draw.rect(screen, key_color, (key_x, piano_top_y, key_width, piano_height), border_radius=5)
            pygame.draw.rect(screen, (20, 20, 25), (key_x, piano_top_y, key_width, piano_height), 2, border_radius=5)

            label_color = (20, 20, 25)
            note_label = self.small_font.render(note_name, True, label_color)
            note_rect = note_label.get_rect(center=(key_x + key_width // 2, piano_top_y + 45))
            screen.blit(note_label, note_rect)

        for i, note_name in enumerate(game.keyboard_notes):
            if "#" not in note_name:
                continue

            key_x = game.key_positions[i]
            key_width = game.key_widths[i]

            lane_color = (38, 38, 50)
            if game.key_flash[i] > 0:
                lane_color = (80, 70, 110)

            pygame.draw.rect(screen, lane_color, (key_x, 0, key_width, HIT_LINE_Y))
            pygame.draw.line(screen, (120, 120, 140), (key_x, HIT_LINE_Y), (key_x + key_width, HIT_LINE_Y), 2)

            black_height = int(piano_height * BLACK_KEY_HEIGHT_RATIO)

            key_color = (10, 10, 15)
            if game.key_flash[i] > 0:
                key_color = (120, 95, 20)

            pygame.draw.rect(screen, key_color, (key_x, piano_top_y, key_width, black_height), border_radius=5)
            pygame.draw.rect(screen, (0, 0, 0), (key_x, piano_top_y, key_width, black_height), 2, border_radius=5)

            label_color = WHITE
            note_label = self.small_font.render(note_name, True, label_color)
            note_rect = note_label.get_rect(center=(key_x + key_width // 2, piano_top_y + 35))
            screen.blit(note_label, note_rect)

    def draw_notes(self, screen, game):
         if game.restart_countdown > 0:
            return

         if game.play_mode == "learn":
            self.draw_learn_notes(screen, game)
            return

         for note in game.notes:
             if note.hit:
                continue

             key_x = game.key_positions[note.lane]
             key_width = game.key_widths[note.lane]

             note_width = max(20, key_width - 8)
             note_x = key_x + key_width // 2 - note_width // 2

             timing_error = abs(note.center_y() - HIT_LINE_Y)
             note_color = HIT_NOTE_COLOR if timing_error <= HIT_WINDOW else NOTE_COLOR

             note_rect = pygame.Rect(note_x, note.y, note_width, NOTE_HEIGHT)

             pygame.draw.rect(screen, note_color, note_rect, border_radius=8)
             pygame.draw.rect(screen, (15, 15, 25), note_rect, 3, border_radius=8)

             label = self.small_font.render(game.keyboard_notes[note.lane], True, (15, 15, 25))
             screen.blit(label, label.get_rect(center=note_rect.center))
    
    def draw_learn_notes(self, screen, game):
        start = game.learn_index
        end = min(len(game.notes), start + game.learn_visible_count)

        center_x = WIDTH // 2
        start_y = 120

        title = self.font.render("Learn Mode - press the next note", True, WHITE)
        screen.blit(title, title.get_rect(center=(center_x, 70)))

        for display_index, note_index in enumerate(range(start, end)):
            note = game.notes[note_index]
            note_name = game.keyboard_notes[note.lane]

            box_width = 120
            box_height = 45
            x = center_x - box_width // 2
            y = start_y + display_index * 58

            color = HIT_NOTE_COLOR if display_index == 0 else NOTE_COLOR
            rect = pygame.Rect(x, y, box_width, box_height)

            pygame.draw.rect(screen, color, rect, border_radius=10)
            pygame.draw.rect(screen, (15, 15, 25), rect, 3, border_radius=10)

            label = self.font.render(note_name, True, (15, 15, 25))
            screen.blit(label, label.get_rect(center=rect.center))

        if game.learn_index >= len(game.notes):
            done = self.big_font.render("Complete!", True, PERFECT_COLOR)
            screen.blit(done, done.get_rect(center=(center_x, 260)))
    
    def draw_ui(self, screen, game):
        total_attempts = game.hits + game.misses
        accuracy = 0

        if total_attempts > 0:
            accuracy = (game.hits / total_attempts) * 100

        # Slim top stats bar
        bar_rect = pygame.Rect(265, 20, 460, 46)
        pygame.draw.rect(screen, (15, 15, 25), bar_rect, border_radius=10)
        pygame.draw.rect(screen, (70, 70, 90), bar_rect, 2, border_radius=10)

        main_text = f"Score: {game.score}    Combo: {game.combo}    Acc: {accuracy:.1f}%"
        main_surface = self.small_font.render(main_text, True, WHITE)
        screen.blit(main_surface, main_surface.get_rect(center=bar_rect.center))

        # Tiny detail box
        detail_text = (
            f"P:{game.perfects}  G:{game.greats}  OK:{game.oks}  "
            f"M:{game.misses}  Max:{game.max_combo}"
        )
        detail_surface = self.small_font.render(detail_text, True, WHITE)

        detail_rect = pygame.Rect(265, 72, 460, 30)
        pygame.draw.rect(screen, (15, 15, 25), detail_rect, border_radius=8)
        pygame.draw.rect(screen, (55, 55, 75), detail_rect, 2, border_radius=8)
        screen.blit(detail_surface, detail_surface.get_rect(center=detail_rect.center))

        self.draw_feedback_popup(screen, game)

        if game.paused:
            pause_surface = self.big_font.render("PAUSED", True, WHITE)
            pause_rect = pause_surface.get_rect(center=(WIDTH // 2, HEIGHT // 2))
            screen.blit(pause_surface, pause_rect)

        controls_text = "R = Menu | P = Pause | M = MIDI | ESC = Quit"
        controls_surface = self.small_font.render(controls_text, True, WHITE)

        box_rect = pygame.Rect(760, 25, 410, 38)
        pygame.draw.rect(screen, (15, 15, 25), box_rect, border_radius=8)
        pygame.draw.rect(screen, (70, 70, 90), box_rect, 2, border_radius=8)

        screen.blit(controls_surface, (775, 35))
        
        
    def draw_feedback_popup(self, screen, game):
        if game.feedback_timer <= 0:
            return

        center_x = 1010
        start_y = 295

        if game.feedback_timer > 40:
            alpha = int((50 - game.feedback_timer) / 10 * 255)
        elif game.feedback_timer < 15:
            alpha = int(game.feedback_timer / 15 * 255)
        else:
            alpha = 255

        alpha = max(0, min(255, alpha))

        judgement_surface = self.big_font.render(game.feedback_text, True, game.feedback_color).convert_alpha()
        judgement_surface.set_alpha(alpha)
        judgement_rect = judgement_surface.get_rect(center=(center_x, start_y))
        screen.blit(judgement_surface, judgement_rect)

        if game.feedback_text != "MISS!" and game.feedback_streak > 0:
            streak_surface = self.font.render(f"Streak: {game.feedback_streak}", True, WHITE).convert_alpha()
            streak_surface.set_alpha(alpha)
            streak_rect = streak_surface.get_rect(center=(center_x, start_y + 38))
            screen.blit(streak_surface, streak_rect)

            timing_surface = self.small_font.render(game.feedback_timing, True, WHITE).convert_alpha()
            timing_surface.set_alpha(alpha)
            timing_rect = timing_surface.get_rect(center=(center_x, start_y + 64))
            screen.blit(timing_surface, timing_rect)
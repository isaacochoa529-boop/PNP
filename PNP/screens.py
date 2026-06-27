import pygame
from settings import *



def draw_start_screen(game):
    overlay = pygame.Surface((WIDTH, HEIGHT))
    overlay.set_alpha(220)
    overlay.fill((20, 20, 30))
    game.screen.blit(overlay, (0, 0))

    title = game.big_font.render("PNP", True, WHITE)
    game.screen.blit(title, title.get_rect(center=(WIDTH // 2, 120)))

    song = game.font.render(game.current_song["title"], True, WHITE)
    game.screen.blit(song, song.get_rect(center=(WIDTH // 2, 190)))

    tempo = game.font.render(
        f"Practice Tempo: {int(game.practice_tempo * 100)}%",
        True,
        PERFECT_COLOR
    )

    mode = game.font.render(f"Mode: {game.play_mode.title()}", True, WHITE)
    game.screen.blit(mode, mode.get_rect(center=(WIDTH // 2, 300)))

    game.screen.blit(tempo, tempo.get_rect(center=(WIDTH // 2, 260)))
    
    mode_text = f"Mode: {game.play_mode.title()}"
    mode = game.font.render(mode_text, True, WHITE)
    game.screen.blit(mode, mode.get_rect(center=(WIDTH // 2, 300)))
    
    midi_status = "Connected" if game.input_manager.midi_enabled else "Not Connected"
    midi = game.font.render(f"MIDI: {midi_status}", True, WHITE)
    game.screen.blit(midi, midi.get_rect(center=(WIDTH // 2, 320)))

    controls = [
        "Up / Down = Change Tempo",
        "M = Reconnect MIDI",
        "Enter = Key Check",
        "Esc = Quit",
        "A / D or Left / Right = Change Song",
        "W / S = Change Mode", 
    ]

    for i, text in enumerate(controls):
        surface = game.small_font.render(text, True, WHITE)
        game.screen.blit(surface, surface.get_rect(center=(WIDTH // 2, 390 + i * 35)))


def draw_calibration_screen(game):
    overlay = pygame.Surface((WIDTH, HEIGHT))
    overlay.set_alpha(220)
    overlay.fill((20, 20, 30))
    game.screen.blit(overlay, (0, 0))

    title = game.big_font.render("Key Check", True, WHITE)
    game.screen.blit(title, title.get_rect(center=(WIDTH // 2, 85)))

    message = game.font.render(game.calibration_message, True, PERFECT_COLOR)
    game.screen.blit(message, message.get_rect(center=(WIDTH // 2, 145)))

    if game.calibration_index < len(game.calibration_notes):
        needed = game.calibration_notes[game.calibration_index]
        needed_surface = game.big_font.render(f"Press {needed}", True, WHITE)
        game.screen.blit(needed_surface, needed_surface.get_rect(center=(WIDTH // 2, 215)))

    notes_text = "Song keys: " + "  ".join(game.calibration_notes)
    notes_surface = game.small_font.render(notes_text, True, WHITE)
    game.screen.blit(notes_surface, notes_surface.get_rect(center=(WIDTH // 2, 300)))

    progress = f"{game.calibration_index}/{len(game.calibration_notes)} checked"
    progress_surface = game.small_font.render(progress, True, WHITE)
    game.screen.blit(progress_surface, progress_surface.get_rect(center=(WIDTH // 2, 340)))

    hint = game.small_font.render("Press Enter to skip/start | M to reconnect MIDI", True, WHITE)
    game.screen.blit(hint, hint.get_rect(center=(WIDTH // 2, 405)))
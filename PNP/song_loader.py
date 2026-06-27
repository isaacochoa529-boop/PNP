import importlib.util
import os


def load_song_list():
    songs = []
    songs_folder = "songs"

    for filename in os.listdir(songs_folder):
        if not filename.endswith(".py"):
            continue

        if filename.startswith("__"):
            continue

        path = os.path.join(songs_folder, filename)
        module_name = filename[:-3]

        spec = importlib.util.spec_from_file_location(module_name, path)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)

        if hasattr(module, "TITLE") and hasattr(module, "CHART"):
            songs.append({
                "filename": filename,
                "title": module.TITLE,
                "artist": getattr(module, "ARTIST", "Unknown"),
                "difficulty": getattr(module, "DIFFICULTY", 1),
                "chart": module.CHART,
            })

    return songs
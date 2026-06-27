from settings import NOTE_HEIGHT


class Note:
    def __init__(self, lane, y):
        self.lane = lane
        self.y = y
        self.hit = False

    def move(self, speed):
        if not self.hit:
            self.y += speed

    def center_y(self):
        return self.y + NOTE_HEIGHT // 2
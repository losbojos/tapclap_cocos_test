export default class GameConfig {
    static readonly ROWS = 10;           // Количество строк игрового поля
    static readonly COLS = 9;           // Количество столбцов игрового поля
    static readonly MIN_BLAST_GROUP_SIZE = 4; // Минимальный размер группы тайлов для сжигания
    static readonly ONE_TILE_SCORE = 1; // Очков за один уничтоженный тайл
    static readonly WIN_SCORE = 100;    // Цель по очкам для победы
    static readonly TOTAL_MOVES = 25;   // Лимит ходов до поражения
    static readonly MAX_SHUFFLE_ATTEMPTS = 3; // Попыток перемешать при отсутствии ходов; затем поражение
    static readonly SHUFFLE_STEP_DELAY_SEC = 0.35; // Пауза между встряхиваниями
    static readonly BOMB_RADIUS = 4;    // Радиус сжигания бомбы
    static readonly SUPER_TILE_THRESHOLD = 5; // Размер группы >= N — появляется супер-тайл
}
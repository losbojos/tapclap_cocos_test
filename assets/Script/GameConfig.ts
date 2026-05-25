export default class GameConfig {
    static readonly ROWS = 10;           // Количество строк игрового поля
    static readonly COLS = 8;           // Количество столбцов игрового поля
    static readonly ONE_TILE_SCORE = 1; // очков за один тайл
    static readonly WIN_SCORE = 100;    // цель (сколько очков набрать для выигрыша)
    static readonly TOTAL_MOVES = 25;   // Сколько дается ходов на игру (до окончания)
    static readonly MAX_SHUFFLE_ATTEMPTS = 3; // попыток перемешать перед проигрышем
    static readonly BOMB_RADIUS = 4;    // При взрыве сжигаются тайлы в радиусе (сколько клеток)
    static readonly SUPER_TILE_THRESHOLD = 5; // группа уничтожена >= 5 => активируется супер-тайл
}
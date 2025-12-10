const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Путь к файлу базы данных
const dbPath = path.resolve(__dirname, '../../data/kredo-bet-bot.db');

// Данные, скопированные из Firestore
const oddsData = [
    { name: "Победа 1", odd: "1", oddSeries: "2", period: 3, scores: ["1:0", "2:0", "3:0", "2:1", "3:1", "3:2"] },
    { name: "Победа 2", odd: "2", oddSeries: "2", period: 3, scores: ["0:1", "0:2", "0:3", "1:2", "1:3", "2:3"] },
    { name: "Ничья", odd: "3", oddSeries: "3", period: 3, scores: ["0:0", "1:1", "2:2"] },
    { name: "1X", odd: "4", oddSeries: "4", period: 3, scores: ["0:0", "1:1", "2:2", "1:0", "2:0", "3:0", "2:1", "3:1", "3:2"] },
    { name: "2X", odd: "5", oddSeries: "4", period: 3, scores: ["0:0", "1:1", "2:2", "0:1", "0:2", "0:3", "1:2", "1:3", "2:3"] },
    { name: "12", odd: "6", oddSeries: "6", period: 3, scores: ["1:0", "2:0", "3:0", "2:1", "3:1", "0:1", "0:2", "0:3", "1:2", "1:3", "2:3", "3:2"] },
    { name: "ТБ 0.5", odd: "7", oddSeries: "8", period: 3, scores: ["1:1", "2:2", "1:0", "2:0", "3:0", "2:1", "3:1", "0:1", "0:2", "0:3", "1:2", "1:3", "2:3", "3:2"] },
    { name: "ТМ 0.5", odd: "8", oddSeries: "9", period: 3, scores: ["0:0"] },
    { name: "ТБ 1", odd: "9", oddSeries: "10", period: 3, scores: ["1:1", "2:2", "2:0", "3:0", "2:1", "3:1", "0:2", "0:3", "1:2", "1:3", "2:3", "3:2"] },
    { name: "ТМ1", odd: "10", oddSeries: "11", period: 3, scores: ["0:0"] },
    { name: "ТМ 1.5", odd: "12", period: 3, scores: ["1:0", "0:0", "0:1"] },
    { name: "ТБ 1.5", odd: "11", oddSeries: "12", period: 3, scores: ["1:1", "2:2", "2:0", "3:0", "2:1", "3:1", "0:2", "0:3", "1:2", "1:3", "3:2", "2:3"] },
    { name: "ТБ 2", odd: "13", oddSeries: "14", period: 3, scores: ["2:2", "3:0", "2:1", "3:1", "0:3", "1:2", "1:3", "2:3", "3:2"] },
    { name: "ТМ 2", odd: "14", oddSeries: "15", period: 3, scores: ["0:0", "1:0", "0:1"] },
    { name: "ТБ 2.5", odd: "15", oddSeries: "16", period: 3, scores: ["2:2", "2:1", "3:1", "1:2", "1:3", "0:3", "3:0", "2:3", "3:2"] },
    { name: "ТМ 2.5", odd: "16", oddSeries: "17", period: 3, scores: ["0:0", "1:1", "1:0", "2:0", "0:1", "0:2"] },
    { name: "ТБ 3", odd: "17", oddSeries: "18", period: 3, scores: ["2:2", "3:1", "1:3", "3:2", "2:3"] },
    { name: "ТМ 3", odd: "18", oddSeries: "19", period: 3, scores: ["0:0", "1:1", "1:0", "2:0", "0:2", "0:1"] },
    { name: "ТБ 3.5", odd: "19", oddSeries: "20", period: 3, scores: ["2:2", "3:1", "1:3", "3:2", "2:3"] },
    { name: "ТМ 3.5", odd: "20", oddSeries: "21", period: 3, scores: ["0:0", "1:1", "1:0", "2:0", "3:0", "2:1", "0:1", "0:2", "0:3", "1:2"] },
    { name: "ИТ1Б0.5", odd: "29", oddSeries: "43", period: 3, scores: ["1:1", "2:2", "1:0", "2:0", "3:0", "2:1", "3:1", "1:2", "1:3", "3:2", "2:3"] },
    { name: "ИТ1М0.5", odd: "30", period: 3, scores: ["0:0", "0:1", "0:2", "0:3"] },
    { name: "ИТ1Б1", odd: "31", period: 3, scores: ["2:2", "2:0", "3:0", "2:1", "3:1", "3:2", "2:3"] },
    { name: "ИТ1М1", odd: "32", period: 3, scores: ["0:0", "0:1", "0:2", "0:3"] },
    { name: "ИТ1Б1.5", odd: "33", oddSeries: "47", period: 3, scores: ["2:2", "2:0", "3:0", "2:1", "3:1", "3:2", "2:3"] },
    { name: "ИТ1М1.5", odd: "34", oddSeries: "48", period: 3, scores: ["0:0", "1:1", "1:0", "0:1", "0:2", "0:3", "1:2", "1:3"] },
    { name: "ИТ1М2", odd: "36", period: 3, scores: ["0:0", "1:1", "1:0", "0:1", "0:2", "0:3", "1:2", "1:3"] },
    { name: "ИТ1М2.5", odd: "38", oddSeries: "52", period: 3, scores: ["0:0", "1:1", "2:2", "1:0", "2:0", "2:1", "0:1", "0:2", "0:3", "1:2", "1:3"] },
    { name: "ИТ2Б0.5", odd: "51", period: 3, scores: ["1:1", "2:2", "2:1", "3:1", "0:1", "0:2", "0:3", "1:2", "1:3", "2:3", "3:2"] },
    { name: "ИТ2М0.5", odd: "52", period: 3, scores: ["0:0", "1:0", "2:0", "3:0"] },
    { name: "ИТ2Б1", odd: "53", period: 3, scores: ["2:2", "0:2", "0:3", "1:2", "1:3", "2:3", "3:2"] },
    { name: "ИТ2М1", odd: "54", period: 3, scores: ["0:0", "1:0", "2:0", "3:0"] },
    { name: "ИТ2Б1.5", odd: "55", period: 3, scores: ["2:2", "0:2", "0:3", "1:2", "1:3", "2:3", "3:2"] },
    { name: "ИТ2М1.5", odd: "56", period: 3, scores: ["0:0", "1:1", "1:0", "2:0", "3:0", "2:1", "3:1", "0:1"] },
    { name: "ИТ2М2", odd: "58", period: 3, scores: ["0:0", "1:1", "1:0", "2:0", "3:0", "2:1", "3:1", "0:1"] },
    { name: "ИТ2М2.5", odd: "60", period: 3, scores: ["0:0", "1:1", "2:2", "1:0", "2:0", "3:0", "2:1", "3:1", "0:1", "0:2", "1:2"] },
    { name: "Ф1 0", odd: "73", period: 3, scores: ["1:0", "2:0", "3:0", "2:1", "3:1", "3:2"] },
    { name: "Ф1 +1", odd: "74", period: 3, scores: ["1:1", "2:2", "0:0", "1:0", "2:0", "3:0", "2:1", "3:1", "3:2"] },
    { name: "Ф1 -1", odd: "75", period: 3, scores: ["2:0", "3:0", "3:1"] },
    { name: "Ф1 +1.5", odd: "76", oddSeries: "39", period: 3, scores: ["0:0", "1:1", "2:2", "1:0", "2:0", "3:0", "2:1", "3:1", "0:1", "1:2", "3:2"] },
    { name: "Ф1 -1.5", odd: "77", oddSeries: "38", period: 3, scores: ["2:0", "3:0", "3:1"] },
    { name: "Ф1 +2", odd: "78", period: 3, scores: ["0:0", "1:1", "2:2", "1:0", "2:0", "3:0", "2:1", "3:1", "0:3", "3:2"] },
    { name: "Ф1 +2.5", odd: "80", period: 3, scores: ["0:0", "1:1", "2:2", "1:0", "2:0", "3:0", "2:1", "3:1", "0:3", "3:2"] },
    { name: "Ф2 0", odd: "86", period: 3, scores: ["0:1", "0:2", "0:3", "1:2", "1:3", "2:3"] },
    { name: "Ф2 +1", odd: "87", period: 3, scores: ["0:1", "0:2", "0:3", "1:2", "1:3", "0:0", "1:1", "2:2", "2:3"] },
    { name: "Ф2 -1", odd: "88", period: 3, scores: ["0:2", "0:3", "1:3"] },
    { name: "Ф2 +1.5", odd: "89", period: 3, scores: ["0:0", "1:1", "2:2", "0:1", "0:2", "0:3", "1:2", "1:3", "1:0", "2:1", "2:3"] },
    { name: "Ф2 -1.5", odd: "90", period: 3, scores: ["0:2", "03:0", "1:3"] },
    { name: "Ф2 +2", odd: "91", period: 3, scores: ["0:0", "1:1", "2:2", "0:1", "0:2", "0:3", "1:2", "1:3", "1:0", "2:1", "2:3"] },
    { name: "Ф2 +2.5", odd: "93", period: 3, scores: ["0:0", "1:1", "2:2", "0:1", "0:2", "0:3", "1:2", "1:3", "1:0", "2:0", "2:1", "3:1", "2:3"] },
    { name: "ОЗ Да", odd: "99", oddSeries: "81", period: 3, scores: ["1:1", "2:2", "2:1", "3:1", "1:2", "1:3", "3:2", "2:3"] },
    { name: "ОЗ Нет", odd: "100", oddSeries: "82", period: 3, scores: ["0:0", "1:0", "2:0", "3:0", "0:1", "0:2", "0:3"] },
    { name: "Результативная ничья Да", odd: "101", period: 3, scores: ["1:1", "2:2"] },
    { name: "Результативная ничья Нет", odd: "102", period: 3, scores: ["0:0"] }
];

/**
 * Creates the database schema.
 */
function setupDatabase(db) {
    db.serialize(() => {
        console.log('Создание схемы базы данных...');
        // Таблица для исходов
        db.run(`
            CREATE TABLE IF NOT EXISTS odds (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                odd_id TEXT UNIQUE NOT NULL,
                name TEXT NOT NULL,
                odd_series TEXT,
                period INTEGER
            )
        `);

        // Таблица для счетов
        db.run(`
            CREATE TABLE IF NOT EXISTS scores (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                score TEXT UNIQUE NOT NULL
            )
        `);

        // Таблица-связка для отношений многие-ко-многим
        db.run(`
            CREATE TABLE IF NOT EXISTS odd_scores (
                odd_id INTEGER NOT NULL,
                score_id INTEGER NOT NULL,
                PRIMARY KEY (odd_id, score_id),
                FOREIGN KEY (odd_id) REFERENCES odds(id),
                FOREIGN KEY (score_id) REFERENCES scores(id)
            )
        `);
        console.log('Схема базы данных успешно создана/проверена.');
    });
}

/**
 * Seeds the database with the provided odds data using a sequential async flow.
 */
function seedDatabase(db, data) {
    console.log('Заполнение базы данных начальными данными...');

    const insertOddStmt = db.prepare("INSERT OR IGNORE INTO odds (odd_id, name, odd_series, period) VALUES (?, ?, ?, ?)");
    const insertScoreStmt = db.prepare("INSERT OR IGNORE INTO scores (score) VALUES (?)");
    const insertOddScoreStmt = db.prepare("INSERT OR IGNORE INTO odd_scores (odd_id, score_id) VALUES (?, ?)");

    let itemIndex = -1;

    function processNextItem() {
        itemIndex++;
        if (itemIndex >= data.length) {
            // Если все элементы обработаны, завершаем
            finalizeStatements();
            return;
        }

        const item = data[itemIndex];
        
        db.serialize(() => {
            // 1. Вставляем исход
            insertOddStmt.run(item.odd, item.name, item.oddSeries, item.period);

            // 2. Получаем его ID
            db.get("SELECT id FROM odds WHERE odd_id = ?", [item.odd], (err, oddRow) => {
                if (err || !oddRow) {
                    console.error('Не удалось получить odd_id для', item.name, err || '');
                    processNextItem(); // Переходим к следующему элементу
                    return;
                }

                const oddId = oddRow.id;
                let scoreIndex = -1;

                function processNextScore() {
                    scoreIndex++;
                    if (scoreIndex >= item.scores.length) {
                        // Все счета для этого исхода обработаны, переходим к следующему исходу
                        processNextItem();
                        return;
                    }
                    const scoreValue = item.scores[scoreIndex];

                    // Вставляем счет и создаем связь
                    db.serialize(() => {
                        insertScoreStmt.run(scoreValue);
                        db.get("SELECT id FROM scores WHERE score = ?", [scoreValue], (err, scoreRow) => {
                            if (err || !scoreRow) {
                                console.error('Не удалось получить score_id для', scoreValue, err || '');
                                processNextScore(); // Переходим к следующему счету
                                return;
                            }
                            const scoreId = scoreRow.id;
                            insertOddScoreStmt.run(oddId, scoreId);
                            processNextScore(); // Успешно, переходим к следующему счету
                        });
                    });
                }
                
                // Начинаем обработку счетов для текущего исхода
                processNextScore();
            });
        });
    }

    function finalizeStatements() {
        insertOddStmt.finalize();
        insertScoreStmt.finalize();
        insertOddScoreStmt.finalize();
        console.log('Заполнение базы данных завершено.');
        
        // Теперь проверка данных сработает корректно
        verifyData(db);
    }

    // Начинаем обработку с первого элемента
    processNextItem();
}


function verifyData(db) {
    db.serialize(() => {
        db.get("SELECT COUNT(*) as count FROM odds", (err, row) => {
            console.log(`Проверка: Найдено ${row.count} записей в таблице 'odds'.`);
        });
        db.get("SELECT COUNT(*) as count FROM scores", (err, row) => {
            console.log(`Проверка: Найдено ${row.count} записей в таблице 'scores'.`);
        });
        db.get("SELECT COUNT(*) as count FROM odd_scores", (err, row) => {
            console.log(`Проверка: Найдено ${row.count} связей в таблице 'odd_scores'.`);
        });
    });
}

// Создаем и подключаемся к базе данных
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        return console.error('Ошибка при подключении к базе данных SQLite:', err.message);
    }
    console.log('Успешное подключение к базе данных SQLite:', dbPath);
    
    // После успешного подключения создаем схему, заполняем ее данными и проверяем
    db.serialize(() => {
        setupDatabase(db);
        seedDatabase(db, oddsData);
        // Небольшая задержка перед проверкой, чтобы дать время на завершение асинхронных вставок
        setTimeout(() => verifyData(db), 1000); 
    });
});

module.exports = { db, oddsData };
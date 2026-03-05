// projectV2/services/syncPRBody.mjs
/**
 * syncPRBody.mjs
 *
 * Головний файл синхронізації PR body.
 *
 * ВІДПОВІДАЛЬНІСТЬ:
 *  - читає поточне тіло PR
 *  - витягує наш попередній auto-блок (snapshot)
 *  - рахує новий стан explicit / linked
 *
 *  - генерує оновлений блок
 *  - повертає фінальний body для update
 *
 * НІЧОГО НЕ ЗНАЄ ПРО GITHUB API.
 * Працює лише з даними.
 */

const BLOCK_START = "<!-- AUTO-LINK-START -->";
const BLOCK_END = "<!-- AUTO-LINK-END -->";

/**
 * Головна функція синхронізації
 *
 * @param {Object} params
 * @param {string} params.prBody - повний поточний body PR (разом з нашим блоком)
 * @param {number[]} params.commitIssues - задачі знайдені у commit messages
 * @param {number[]} params.graphQlIssues - closing references з GraphQL
 *
 * @returns {{
 *   updatedBody: string,
 *   explicit: number[],
 *   linked: number[]
 * }}
 */
export function syncPRBody({
                               prBody,
                               commitIssues,
                               graphQlIssues,
                           }) {
    // ------------------------------------------------------------
    // 1️⃣ Витягуємо попередній блок (snapshot)
    // ------------------------------------------------------------
    const { cleanBody, previousBlock } = extractPreviousBlock(prBody);

    const previousExplicit = previousBlock?.explicit ?? [];
    const previousLinked = previousBlock?.linked ?? [];

    // ------------------------------------------------------------
    // 2️⃣ Витягуємо explicit задачі з чистого body
    // ------------------------------------------------------------
    const bodyExplicit = extractIssuesFromText(cleanBody);

    // ------------------------------------------------------------
    // 3️⃣ Формуємо currentExplicit = body ∪ commits
    // ------------------------------------------------------------
    const currentExplicit = unique([
        ...bodyExplicit,
        ...commitIssues,
    ]);

    // ------------------------------------------------------------
    // 4️⃣ Обчислюємо preservedLinked
    // Залишаємо тільки ті попередні linked,
    // які ще присутні в GraphQL
    // ------------------------------------------------------------
    const preservedLinked = intersect(previousLinked, graphQlIssues);

    // ------------------------------------------------------------
    // 5️⃣ Нові UI linked задачі
    // Це ті що:
    // - є в GraphQL
    // - не були explicit раніше
    // - не є explicit зараз
    // ------------------------------------------------------------
    const newUiLinked = graphQlIssues.filter(
        (issue) =>
            !previousExplicit.includes(issue) &&
            !currentExplicit.includes(issue)
    );

    // ------------------------------------------------------------
    // 6️⃣ Формуємо currentLinked
    // ------------------------------------------------------------
    const currentLinked = unique([
        ...preservedLinked,
        ...newUiLinked,
    ]);

    // ------------------------------------------------------------
    // 7️⃣ Генеруємо новий auto-block
    // ------------------------------------------------------------
    const newBlock = buildAutoBlock({
        explicit: currentExplicit,
        linked: currentLinked,
    });

    // ------------------------------------------------------------
    // 8️⃣ Формуємо фінальний body
    // ------------------------------------------------------------
    const updatedBody = `${cleanBody.trim()}\n\n${newBlock}`;

    return {
        updatedBody,
        explicit: currentExplicit,
        linked: currentLinked,
    };
}

//////////////////////////////////////////////////////////////////
// =================== INTERNAL HELPERS =========================
//////////////////////////////////////////////////////////////////

/**
 * Витягує наш попередній auto-block
 * Повертає:
 *  - cleanBody (без блоку)
 *  - previousBlock { explicit, linked }
 */
function extractPreviousBlock(body) {
    const start = body.indexOf(BLOCK_START);
    const end = body.indexOf(BLOCK_END);

    if (start === -1 || end === -1) {
        return {
            cleanBody: body,
            previousBlock: null,
        };
    }

    const blockContent = body.slice(
        start + BLOCK_START.length,
        end
    );

    const cleanBody =
        body.slice(0, start) +
        body.slice(end + BLOCK_END.length);

    return {
        cleanBody,
        previousBlock: parseBlock(blockContent),
    };
}

/**
 * Парсить explicit / linked з блоку
 */
function parseBlock(content) {
    const explicitMatch = content.match(/Explicit:\s*(.*)/);
    const linkedMatch = content.match(/Linked:\s*(.*)/);

    return {
        explicit: explicitMatch
            ? parseNumbers(explicitMatch[1])
            : [],
        linked: linkedMatch
            ? parseNumbers(linkedMatch[1])
            : [],
    };
}

/**
 * Генерує auto-block
 */
function buildAutoBlock({ explicit, linked }) {
    return `${BLOCK_START}
Explicit: ${explicit.join(", ")}
Linked: ${linked.join(", ")}
${BLOCK_END}`;
}

/**
 * Витягує номери задач з тексту (Closes #123 і т.д.)
 */
function extractIssuesFromText(text) {
    const regex = /#(\d+)/g;
    const matches = [...text.matchAll(regex)];
    return unique(matches.map((m) => Number(m[1])));
}

/**
 * Парсить "1,2,3" → [1,2,3]
 */
function parseNumbers(str) {
    return str
        .split(",")
        .map((x) => Number(x.trim()))
        .filter(Boolean);
}

function unique(arr) {
    return [...new Set(arr)];
}

function intersect(a, b) {
    return a.filter((x) => b.includes(x));
}

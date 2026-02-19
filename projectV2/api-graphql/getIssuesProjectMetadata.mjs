export async function getIssuesProjectMetadata(github, { owner, repo, issueNumbers }) {
    // Якщо масив порожній, не робимо запит
    if (!issueNumbers || issueNumbers.length === 0) return [];

    // Формуємо запит динамічно для кожного номера ісуса
    // Використовуємо аліаси (issue_0, issue_1...), бо GraphQL не дозволяє запит масиву ID за номерами в одному полі
    const issueQueries = issueNumbers.map((num, index) => `
        issue_${index}: issue(number: ${num}) {
            id
            number
            projectItems(first: 10) {
                nodes {
                    id
                    project { id }
                }
            }
        }
    `).join('\n');

    const query = `
        query($owner: String!, $repo: String!) {
            repository(owner: $owner, name: $repo) {
                ${issueQueries}
            }
        }
    `;

    try {
        const res = await github.graphql(query, { owner, repo });

        // Перетворюємо об'єкт з аліасами назад у масив
        if (!res.repository) return [];
        return Object.values(res.repository).filter(issue => issue !== null);

    } catch (error) {
        throw new Error(`GraphQL Error fetching issues metadata: ${error.message}`);
    }
}
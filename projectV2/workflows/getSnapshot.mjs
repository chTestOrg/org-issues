/*
export default async function getSnapshot({ github, context, core }) {
    const start = 2;
    const end = 100; // діапазон номерів issues
    const owner = context.repo.owner;
    const repo = context.repo.repo;

    // Створюємо масив номерів [1, 2, 3... 10]
    const issueNumbers = Array.from({ length: end - start + 1 }, (_, i) => i + start);

    if (issueNumbers.length === 0) {
        core.warning("No issues to fetch. Exiting.");
        return {};
    }

    // Формуємо batch query
    // Важливо: ми використовуємо змінні owner та repo з контексту
    const queryParts = issueNumbers.map((number, i) => `
      issue_${i}: repository(owner: "${owner}", name: "${repo}") {
        issue(number: ${number}) {
          number
          title
          projectItems(first: 10) {
            nodes {
              id
              project { id title }
              fieldValues(first: 20) {
                nodes {
                  __typename
                  ... on ProjectV2ItemFieldSingleSelectValue {
                    name
                    optionId
                    field { ... on ProjectV2FieldCommon { id name } }
                  }
                  ... on ProjectV2ItemFieldTextValue {
                    text
                    field { ... on ProjectV2FieldCommon { id name } }
                  }
                  # Додано для підтримки інших типів полів, якщо потрібно
                  ... on ProjectV2ItemFieldNumberValue {
                    number
                    field { ... on ProjectV2FieldCommon { id name } }
                  }
                }
              }
            }
          }
        }
      }
    `).join("\n");

    const query = `query { ${queryParts} }`;

    let data;
    try {
        data = await github.graphql(query);
    } catch (err) {
        core.error(`GraphQL request failed: ${err.message}`);
        core.setFailed("Snapshot aborted due to GraphQL error.");
        return {};
    }

    const registry = {};

    // Обробка результатів
    Object.values(data).forEach(repoData => {
        const issue = repoData?.issue;
        if (!issue) return;

        const issueUrl = `https://github.com/${owner}/${repo}/issues/${issue.number}`;

        issue.projectItems?.nodes.forEach(item => {
            const fields = {};

            (item.fieldValues?.nodes ?? []).forEach(f => {
                // Отримуємо назву поля з об'єкта field
                const fieldName = f.field?.name;
                if (!fieldName) return;

                if (f.__typename === "ProjectV2ItemFieldSingleSelectValue") {
                    fields[fieldName] = {
                        id: f.field.id,
                        optionId: f.optionId,
                        value: f.name
                    };
                } else if (f.__typename === "ProjectV2ItemFieldTextValue") {
                    fields[fieldName] = {
                        id: f.field.id,
                        value: f.text
                    };
                } else if (f.__typename === "ProjectV2ItemFieldNumberValue") {
                    fields[fieldName] = {
                        id: f.field.id,
                        value: f.number
                    };
                }
            });

            registry[issueUrl] = {
                issueNumber: issue.number,
                title: issue.title,
                owner: owner,
                repo: repo,
                itemId: item.id,
                projectId: item.project?.id,
                projectName: item.project?.title,
                fields
            };
        });
    });

    core.info(`Successfully fetched ${Object.keys(registry).length} items.`);
    console.log(JSON.stringify(registry, null, 2));
    return registry;
}*/

export default async function getSnapshot({ github, context, core }) {
    const start = 1;
    const end = 100;
    const owner = context.repo.owner;
    const repo = context.repo.repo;

    const issueNumbers = Array.from({ length: end - start + 1 }, (_, i) => i + start);

    if (issueNumbers.length === 0) {
        core.warning("No issues to fetch. Exiting.");
        return {};
    }

    const queryParts = issueNumbers.map((number, i) => `
      issue_${i}: repository(owner: "${owner}", name: "${repo}") {
        issue(number: ${number}) {
          number
          title
          projectItems(first: 10) {
            nodes {
              id
              project { id title }
              fieldValues(first: 20) {
                nodes {
                  __typename
                  ... on ProjectV2ItemFieldSin0gleSelectValue {
                    name
                    optionId
                    field { ... on ProjectV2FieldCommon { id name } }
                  }
                  ... on ProjectV2ItemFieldTextValue {
                    text
                    field { ... on ProjectV2FieldCommon { id name } }
                  }
                }
              }
            }
          }
        }
      }
    `).join("\n");

    const query = `query { ${queryParts} }`;
    let data = {};
    try {
        data = await github.graphql(query);
    } catch (err) {
        // КЛЮЧОВИЙ МОМЕНТ:
        // Якщо частина запитів зафейлилася (наприклад, issue не знайдено),
        // GraphQL повертає помилку, але в err.data є результати тих аліасів, які спрацювали.
        if (err.data) {
            core.warning(`Деякі задачі не було знайдено або виникли помилки доступу: ${err.message}`);
            data = err.data; // Продовжуємо з тим, що вдалося отримати
        } else {
            core.setFailed(`Критична помилка запиту: ${err.message}`);
            return {};
        }
    }

    const registry = {};

    // Тепер проходимося по всіх отриманих ключах (issue_0, issue_1 і т.д.)
    Object.keys(data).forEach(key => {
        const repoData = data[key];

        // Перевіряємо, чи є дані всередині цього аліасу.
        // Якщо issue не знайдено, repoData або repoData.issue буде null.
        if (!repoData || !repoData.issue) {
            // core.info(`Пропускаємо ${key}: задачу не знайдено.`);
            return;
        }

        const issue = repoData.issue;
        const issueUrl = `https://github.com/${owner}/${repo}/issues/${issue.number}`;

        // Якщо задача не прив'язана до проектів, nodes буде порожнім масивом
        if (!issue.projectItems?.nodes || issue.projectItems.nodes.length === 0) {
            return;
        }

        issue.projectItems.nodes.forEach(item => {
            const fields = {};
            (item.fieldValues?.nodes ?? []).forEach(f => {
                const fieldName = f.field?.name;
                if (!fieldName) return;

                if (f.__typename === "ProjectV2ItemFieldSingleSelectValue") {
                    fields[fieldName] = { id: f.field.id, optionId: f.optionId, value: f.name };
                } else if (f.__typename === "ProjectV2ItemFieldTextValue") {
                    fields[fieldName] = { id: f.field.id, value: f.text };
                }
            });

            registry[issueUrl] = {
                issueNumber: issue.number,
                title: issue.title,
                owner: owner,
                repo: repo,
                itemId: item.id,
                projectId: item.project?.id,
                fields
            };
        });
    });

    core.info(`Успішно оброблено задач: ${Object.keys(registry).length}`);
    core.info(JSON.stringify(registry, null, 2));
    return registry;
}
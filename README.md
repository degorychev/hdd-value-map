# HDD + ZFS Analyzer

Статическая публикационная сборка инструмента для сравнения HDD под ZFS.

## Что внутри

- `index.html` — страница приложения
- `styles.css` — стили, вынесенные из монолитного HTML
- `app.js` — логика приложения, вынесенная из монолитного HTML
- `.nojekyll` — отключает лишнюю обработку GitHub Pages
- `snapshot/dns_zfs_tool_original.html` — сохранённый исходный монолит на случай отката

## Как запустить локально

Достаточно открыть `index.html` в браузере.

Если браузер будет строже относиться к локальным файлам, можно поднять простой статический сервер из этой папки:

```powershell
python -m http.server 8000
```

После этого открыть `http://localhost:8000`.

## Как опубликовать в GitHub Pages

### Вариант через веб-интерфейс GitHub

1. Создай новый репозиторий на GitHub.
2. Если у тебя тариф `GitHub Free`, сделай репозиторий публичным: для GitHub Pages на Free это важно.
3. Залей в репозиторий содержимое этой папки `github-pages-site`, именно содержимое, а не саму внешнюю папку.
4. На GitHub открой `Settings` -> `Pages`.
5. В блоке `Build and deployment` выбери:
   `Source` -> `Deploy from a branch`
6. Выбери ветку `main` и папку `/(root)`.
7. Нажми `Save`.
8. Подожди несколько минут и открой ссылку вида:
   `https://<username>.github.io/<repo>/`

### Вариант через git из терминала

```powershell
cd "C:\Users\deneg\OneDrive\Документы\codex\dns\github-pages-site"
git init
git branch -M main
git add .
git commit -m "Initial GitHub Pages version"
git remote add origin https://github.com/<username>/<repo>.git
git push -u origin main
```

Потом включи GitHub Pages в `Settings` -> `Pages` так же, как описано выше.

## Что важно помнить

- GitHub Pages публикует обычные статические файлы, так что этот инструмент подходит хорошо.
- В репозиторий лучше не класть большие HAR-файлы без необходимости.
- Если сайт не обновился сразу, GitHub пишет, что публикация может занять до 10 минут.
- Если когда-нибудь добавишь генератор или сборщик, текущую простую схему всё равно можно сохранить, публикуя уже готовые статические файлы.

## Полезные ссылки

- [Creating a GitHub Pages site](https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site)
- [Configuring a publishing source for your GitHub Pages site](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)
- [Securing your GitHub Pages site with HTTPS](https://docs.github.com/en/pages/getting-started-with-github-pages/securing-your-github-pages-site-with-https)

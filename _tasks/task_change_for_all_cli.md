# タスク
「Claude Code以外でも使えるようにする」のタスクを整理するためのチェックリストです。
チェックリストを作成したりタスクが増えたら、ユーザーの指示がなくても編集してください。
チェックリストのタスクが完了したらユーザーの指示がなくても編集してください。

## やりたいこと

このリポジトリはもともとClaude Code向けに作っていたが、他のCLIでも使えるようにしたい。
プロセス名自体は`PROCESS_NAME`なので、これを`DEFAULT_EDITOR`のように「デフォルトは`claude`、でも引数で変更できる」ってしてほしい

また、関数名などに`claude`が入ってるやつが多いので、それの名前も変えたい

## チェックリスト

`A: `のようにアルファベットのラベルをつけることで、参照しやすくする

### 1. タスク分解

- [x] A: タスク分解して2以降のチェックリストを書き換える

### 2. CLI引数でプロセス名を指定可能にする

- [x] B: constants.tsのPROCESS_NAMEをDEFAULT_PROCESS_NAMEに変更
- [x] C: CLI引数に --process オプションを追加（デフォルト："claude"）
- [x] D: process.tsの各関数でプロセス名を引数で受け取るように修正
- [x] E: index.tsで引数のプロセス名を各関数に渡すように修正

### 3. 関数名・型名の汎用化

- [x] F: ClaudeProcess型を汎用的な名前に変更（例：TargetProcess）
- [x] G: findClaudeProcesses関数を汎用的な名前に変更（例：findTargetProcesses）
- [x] H: findClaudeInTmux関数を汎用的な名前に変更（例：findTargetInTmux）
- [x] I: sendContentToProcess関数内のClaude固有のメッセージを汎用化

### 4. ログ・メッセージの汎用化

- [x] J: index.tsの「Searching for Claude processes...」メッセージを汎用化
- [x] K: 「No Claude process found.」メッセージを汎用化
- [x] L: 「Sending content to Claude process...」メッセージを汎用化

### 5. テストファイルの更新

- [x] M: test/modules/process.test.tsのテストを汎用的な名前に更新
- [x] N: test/modules/selector.test.tsのテストを汎用的な名前に更新
- [x] O: test/integration.test.tsのテストを汎用的な名前に更新

### 6. ドキュメント更新

- [x] P: README.mdの説明を汎用的な内容に更新
- [x] Q: CLAUDE.mdのプロジェクト説明を汎用化
- [x] R: package.jsonのdescriptionを汎用化

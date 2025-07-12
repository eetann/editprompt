# タスク
「npmパッケージとして公開する」のタスクを整理するためのチェックリストです。
チェックリストを作成したりタスクが増えたら、ユーザーの指示がなくても編集してください。
チェックリストのタスクが完了したらユーザーの指示がなくても編集してください。

## やりたいこと

npmパッケージとして公開したいので、その手順をチェックリストにしてほしい

## チェックリスト

`A: `のようにアルファベットのラベルをつけることで、参照しやすくする

### 1. タスク分解

- [x] A: タスク分解して2以降のチェックリストを書き換える
    - 現在の状況：package.jsonは公開準備ほぼ完了、TypeScriptビルド設定済み、テストあり

### 2. 公開前の準備・検証

- [x] B: ビルドが正常に動作することを確認する
- [x] C: テストが全て通ることを確認する
- [x] D: package.jsonの必要な項目が全て揃っているか確認する
    - name, version, description, main, bin, files, etc.
- [ ] E: README.mdから"WIP"表記を削除し、完成版に仕上げる
- [ ] F: LICENSEファイルが正しく設定されているか確認する

### 3. npmアカウント・認証の準備

- [ ] G: npmアカウントにログインしているか確認する（npm whoami）
- [ ] H: 2FAが設定されている場合は認証の準備をする
- [ ] I: パッケージ名が利用可能かチェックする（npm search editprompt）

### 4. GitHub Actions自動公開の設定

- [x] J: `.github/workflows/publish.yml`を作成する（リリース時の自動公開）
- [x] K: `.github/workflows/ci.yml`を作成する（CI/品質チェック）
- [ ] L: GitHub SecretsにNPM_TOKENを設定する
- [ ] M: npmアカウントでアクセストークンを作成する

### 5. 公開実行（GitHub Actions経由）

- [ ] N: GitHubでリリース作成（タグ作成→自動ビルド・公開）
- [ ] O: 公開後に実際にインストールできるか確認する（npm install -g editprompt）

### 6. 公開後の確認・保守

- [ ] P: npmjs.comでパッケージページが正しく表示されるか確認する
- [ ] Q: 今後の更新手順をドキュメント化する

## GitHub Actions設定詳細

### NPM_TOKEN設定手順
1. npmjs.comでアカウントにログイン
2. Access Tokens → Generate New Token → Automation を選択
3. GitHubリポジトリのSettings → Secrets and variables → Actions
4. New repository secret で `NPM_TOKEN` として設定

# 環境変数オプション追加機能の設計

## 概要設計

環境変数オプション機能を実装するために、以下の3つのコンポーネントを改修・追加する：

1. CLIインターフェース（`src/index.ts`）
2. エディタモジュール（`src/modules/editor.ts`）
3. 環境変数パーサー（新規ユーティリティ）

## 詳細設計

### 1. CLIインターフェースの拡張

`src/index.ts`に`env`オプションを追加：

```typescript
args: {
  // 既存のオプション...
  env: {
    short: "E",  // -e は editor で使用済みなので -E を使用
    description: "Environment variables to set (e.g., KEY=VALUE)",
    type: "string",
    multiple: true,  // 複数の環境変数を受け取れるようにする
  },
}
```

### 2. エディタモジュールの改修

#### 2.1 関数シグネチャの変更

```typescript
// 環境変数を受け取れるように引数を追加
export async function launchEditor(
  editor: string,
  filePath: string,
  envVars?: Record<string, string>,
): Promise<void>

export async function openEditorAndGetContent(
  editorOption?: string,
  envVars?: string[],  // CLIから受け取った生の環境変数配列
): Promise<string>
```

#### 2.2 launchEditor関数の実装変更

```typescript
export async function launchEditor(
  editor: string,
  filePath: string,
  envVars?: Record<string, string>,
): Promise<void> {
  return new Promise((resolve, reject) => {
    // 環境変数の準備
    const processEnv = {
      ...process.env,
      EDITPROMPT: "1",  // 常に付与
      ...envVars,       // ユーザー指定の環境変数
    };

    const editorProcess = spawn(editor, [filePath], {
      stdio: "inherit",
      shell: true,
      env: processEnv,  // 環境変数を設定
    });

    // 以下、既存のエラーハンドリング処理...
  });
}
```

### 3. 環境変数パーサーユーティリティ

新規ファイル `src/utils/envParser.ts` を作成：

```typescript
/**
 * 環境変数文字列をパースしてオブジェクトに変換
 * @param envStrings - ["KEY=VALUE", "FOO=bar"] 形式の配列
 * @returns 環境変数のキーバリューオブジェクト
 */
export function parseEnvVars(envStrings?: string[]): Record<string, string> {
  if (!envStrings || envStrings.length === 0) {
    return {};
  }

  const result: Record<string, string> = {};
  
  for (const envString of envStrings) {
    const [key, ...valueParts] = envString.split("=");
    
    if (!key || valueParts.length === 0) {
      throw new Error(`Invalid environment variable format: ${envString}`);
    }
    
    const value = valueParts.join("="); // 値に=が含まれる場合に対応
    result[key] = value;
  }
  
  return result;
}
```

### 4. データフロー

1. ユーザーがCLIで `--env KEY=VALUE` を指定
2. gunshiが`ctx.values.env`として配列で受け取る（複数指定の場合）
3. `openEditorAndGetContent`に環境変数配列を渡す
4. `parseEnvVars`で配列をオブジェクトに変換
5. `launchEditor`で環境変数を設定してエディタを起動

### 5. エラーハンドリング

- 不正な環境変数形式（`=`が含まれない等）の場合はエラーメッセージを表示
- 環境変数名が不正な場合（数字で始まる等）は警告を表示

### 6. テスト戦略

1. `parseEnvVars`関数の単体テスト
   - 正常系：単一/複数の環境変数
   - 異常系：不正な形式
   
2. `launchEditor`関数の統合テスト
   - 環境変数が正しく設定されることを確認
   - `EDITPROMPT=1`が常に設定されることを確認

## 実装上の注意点

1. **後方互換性**: 既存の動作を変更しないよう、環境変数パラメータはオプショナルにする
2. **セキュリティ**: 環境変数の値にシェルインジェクションが含まれないよう、`spawn`の`shell: true`オプションと環境変数の設定は分離されている
3. **優先順位**: `EDITPROMPT=1`は常に設定され、ユーザー指定の環境変数で上書きできない
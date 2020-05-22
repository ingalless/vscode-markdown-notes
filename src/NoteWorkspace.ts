import * as vscode from 'vscode';
import { basename, dirname, join, normalize, relative, resolve } from 'path';
import { existsSync, readFile, writeFileSync } from 'fs';

// This class contains:
// 1. an interface to some of the basic user configurable settings or this extension
// 2. command for creating a New Note
// 3. some other bootstrapping
export class NoteWorkspace {
  static _rxTagNoAnchors = '\\#[\\w-_]+'; // used to match tags that appear within lines
  static _rxTagWithAnchors = '^\\#[\\w-_]+$'; // used to match entire words
  static _rxWikiLink = '\\[\\[[\\w\\.-_\\/\\\\]+'; // [[wiki-link-regex
  static _rxMarkdownWordPattern = '([_\\w\\#\\.\\/\\\\]+)'; // had to add [".", "/", "\"] to get relative path completion working and ["#"] to get tag completion working

  static rxTagNoAnchors(): RegExp {
    return new RegExp(this._rxTagNoAnchors, 'i');
  }
  static rxTagWithAnchors(): RegExp {
    return new RegExp(this._rxTagWithAnchors, 'i');
  }
  static rxWikiLink(): RegExp {
    return new RegExp(this._rxWikiLink, 'i');
  }
  static rxMarkdownWordPattern(): RegExp {
    return new RegExp(this._rxMarkdownWordPattern);
  }

  static useUniqueFilenames(): boolean {
    return false;
    let cfg = vscode.workspace.getConfiguration('vscodeMarkdownNotes');
    return cfg.get('workspaceFilenameConvention') == 'uniqueFilenames';
  }

  static createNoteOnGoToDefinitionWhenMissing(): boolean {
    let cfg = vscode.workspace.getConfiguration('vscodeMarkdownNotes');
    return !!cfg.get('createNoteOnGoToDefinitionWhenMissing');
  }

  static filenameForConvention(uri: vscode.Uri, fromDocument: vscode.TextDocument): string {
    if (this.useUniqueFilenames()) {
      return basename(uri.path);
    } else {
      let toPath = uri.path;
      let fromDir = dirname(fromDocument.uri.path.toString());
      let rel = normalize(relative(fromDir, toPath));
      return rel;
    }
  }

  static newNote(context: vscode.ExtensionContext) {
    // console.debug('newNote');
    const inputBoxPromise = vscode.window.showInputBox({
      prompt:
        "Enter a 'Title Case Name' to create `title-case-name.md` with '# Title Case Name' at the top.",
      value: '',
    });

    let workspaceUri = '';
    if (vscode.workspace.workspaceFolders) {
      workspaceUri = vscode.workspace.workspaceFolders[0].uri.path.toString();
    }

    inputBoxPromise.then(
      (noteName) => {
        if (noteName == null || !noteName || noteName.replace(/\s+/g, '') == '') {
          // console.debug('Abort: noteName was empty.');
          return false;
        }

        const filename =
          noteName
            .replace(/\W+/gi, '-') // non-words to hyphens
            .toLowerCase() // lower
            .replace(/-*$/, '') + '.md'; // removing trailing '-' chars, add extension
        const filepath = join(workspaceUri, filename);

        const fileAlreadyExists = existsSync(filepath);
        // create the file if it does not exists
        if (!fileAlreadyExists) {
          const contents = `# ${noteName}\n\n`;
          writeFileSync(filepath, contents);
        }

        // open the file:
        vscode.window
          .showTextDocument(vscode.Uri.file(filepath), {
            preserveFocus: false,
            preview: false,
          })
          .then(() => {
            // if we created a new file, hop to line #3
            if (!fileAlreadyExists) {
              let editor = vscode.window.activeTextEditor;
              if (editor) {
                const lineNumber = 3;
                let range = editor.document.lineAt(lineNumber - 1).range;
                editor.selection = new vscode.Selection(range.start, range.end);
                editor.revealRange(range);
              }
            }
          });
      },
      (err) => {
        vscode.window.showErrorMessage('Error creating new note.');
        // console.error(err);
      }
    );
  }

  static overrideMarkdownWordPattern() {
    // console.debug('overrideMarkdownWordPattern');
    vscode.languages.setLanguageConfiguration('markdown', {
      wordPattern: this.rxMarkdownWordPattern(),
    });
  }
}

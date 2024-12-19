import * as vscode from 'vscode';


function setThemeBasedOnTime() {
	const hour = new Date().getHours();
	const theme = ((hour >= 2 && hour < 4) ? 'Red' : (hour >= 7 && hour < 19) ? 'Quiet Light' : 'Abyss');
	
	vscode.workspace.getConfiguration().update('workbench.colorTheme', theme, vscode.ConfigurationTarget.Global);
}

let pomodoroInterval: NodeJS.Timeout | null = null;
let pomodoroTimeRemaining = 25 * 60;

function startPomodoroTimer() {
	if (pomodoroInterval) {
			clearInterval(pomodoroInterval);
	}

	pomodoroTimeRemaining = 25 * 60;
	updatePomodoroStatus();

	pomodoroInterval = setInterval(() => {
			pomodoroTimeRemaining -= 1;
			updatePomodoroStatus();

			if (pomodoroTimeRemaining <= 0) {
					clearInterval(pomodoroInterval!);
					vscode.window.showInformationMessage('Таймер истек! Время для перерыва.');
					pomodoroTimeRemaining = 5 * 60;
					updatePomodoroStatus();
			}
	}, 1000);
}

function updatePomodoroStatus() {
	const minutes = Math.floor(pomodoroTimeRemaining / 60);
	const seconds = pomodoroTimeRemaining % 60;
	const time = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
	
	vscode.window.setStatusBarMessage(`Таймер: ${time}`, pomodoroTimeRemaining);
}

function startBreakTimer() {
	if (pomodoroInterval) {
			clearInterval(pomodoroInterval);
	}

	pomodoroTimeRemaining = 5 * 60;
	updatePomodoroStatus();

	pomodoroInterval = setInterval(() => {
			pomodoroTimeRemaining -= 1;
			updatePomodoroStatus();

			if (pomodoroTimeRemaining <= 0) {
					clearInterval(pomodoroInterval!);
					vscode.window.showInformationMessage('Перерыв завершён! Время продолжить работать.');
			}
	}, 1000);
}

interface Task {
	text: string;
	completed: boolean;
	line: number;
	file: string;
}

let tasks: Task[] = [];

function parseTasks() {
	const editor = vscode.window.activeTextEditor;
	if (!editor) {
			return;
	}

	const document = editor.document;
	const newTasks: Task[] = [];

	const regex = /\/\/\s*(TODO|FIXME)\s*(.*)|\/\/\s*-\s*\[([ x])\]\s*(.*)/g;

	for (let line = 0; line < document.lineCount; line++) {
			const lineText = document.lineAt(line).text;
			let match;
			while ((match = regex.exec(lineText)) !== null) {
					if (match[1]) {
							newTasks.push({
									text: match[2],
									completed: false,
									line: line,
									file: document.fileName
							});
					} else if (match[3]) {
							newTasks.push({
									text: match[4],
									completed: match[3] === 'x',
									line: line,
									file: document.fileName
							});
					}
			}
	}

	tasks = newTasks;
}

function updateTaskPanel(panel: vscode.WebviewPanel) {
	const taskListHtml = tasks.map(task => {
			return `<div style="margin: 10px; color: ${task.completed ? 'green' : 'red'};">
									<input type="checkbox" ${task.completed ? 'checked' : ''} onclick="toggleCompletion(${task.line})">
									<span>${task.text}</span>
							</div>`;
	}).join('');

	panel.webview.html = `
			<html>
					<body>
							<h2>Задачи и Чек-листы</h2>
							<div>
									${taskListHtml}
							</div>
							<script>
									function toggleCompletion(line) {
											const vscode = acquireVsCodeApi();
											vscode.postMessage({ command: 'toggleCompletion', line: line });
									}
							</script>
					</body>
			</html>
	`;
}

function toggleTaskCompletion(line: number, panel: vscode.WebviewPanel) {
	const task = tasks.find(t => t.line === line);
	if (task) {
			task.completed = !task.completed;
			updateTaskPanel(panel);
	}
}


export function activate(context: vscode.ExtensionContext) {
		let disposable = vscode.commands.registerCommand('extension.openTaskPanel', () => {
				parseTasks();
			
				const panel = vscode.window.createWebviewPanel(
						'taskPanel',
						'Задачи и Чек-листы',
						vscode.ViewColumn.One,
						{}
				);

				updateTaskPanel(panel);

				panel.webview.onDidReceiveMessage((message) => {
						if (message.command === 'toggleCompletion') {
								toggleTaskCompletion(message.line, panel);
						}
				});
		});

		context.subscriptions.push(disposable);

		let disposablePomodoro = vscode.commands.registerCommand('extension.startPomodoro', () => {
				startPomodoroTimer();
		});

		let disposableBreak = vscode.commands.registerCommand('extension.startBreak', () => {
				startBreakTimer();
		});

		setThemeBasedOnTime();

		setInterval(setThemeBasedOnTime, 10000);

		context.subscriptions.push(disposablePomodoro, disposableBreak);
    let disposableRemoveComments = vscode.commands.registerCommand('extension.removeComments', () => {
        let editor = vscode.window.activeTextEditor;
        if (editor) {
            vscode.window.showQuickPick(
                ['Remove all comments', 'Remove single-line comments', 'Remove multi-line comments'], 
                { placeHolder: 'Choose comment type to remove' }
            ).then(selection => {
                if (selection) {
                    if (selection === 'Remove all comments') {
                        removeCommentsFromEditor(editor, 'both');
                    } else if (selection === 'Remove single-line comments') {
                        removeCommentsFromEditor(editor, 'single');
                    } else if (selection === 'Remove multi-line comments') {
                        removeCommentsFromEditor(editor, 'multi');
                    }
                }
            });
        }
    });

    let disposableHighlightComments = vscode.commands.registerCommand('extension.highlightComments', () => {
        let editor = vscode.window.activeTextEditor;
        if (editor) {
            vscode.window.showQuickPick(
                ['Highlight all comments', 'Highlight single-line comments', 'Highlight multi-line comments'], 
                { placeHolder: 'Choose comment type to highlight' }
            ).then(selection => {
                if (selection) {
                    if (selection === 'Highlight all comments') {
                        highlightCommentsInEditor(editor, 'both');
                    } else if (selection === 'Highlight single-line comments') {
                        highlightCommentsInEditor(editor, 'single');
                    } else if (selection === 'Highlight multi-line comments') {
                        highlightCommentsInEditor(editor, 'multi');
                    }
                }
            });
        }
    });

    context.subscriptions.push(disposableRemoveComments);
    context.subscriptions.push(disposableHighlightComments);
}

function highlightCommentsInEditor(editor: vscode.TextEditor, commentType: 'both' | 'single' | 'multi') {
    const document = editor.document;
    const text = document.getText();

    const singleLineCommentRegex = /\/\/.*$/gm;
    const multiLineCommentRegex = /\/\*[\s\S]*?\*\//g;

    let singleLineMatches: vscode.Range[] = [];
    let multiLineMatches: vscode.Range[] = [];

    if (commentType === 'both' || commentType === 'single') {
        singleLineMatches = findMatches(editor, singleLineCommentRegex);
    }

    if (commentType === 'both' || commentType === 'multi') {
        multiLineMatches = findMatches(editor, multiLineCommentRegex);
    }

    const decorationType = vscode.window.createTextEditorDecorationType({
        backgroundColor: 'rgba(255, 0, 0, 0.3)',
        borderRadius: '3px',
        border: '1px solid red'
    });

    editor.setDecorations(decorationType, [...singleLineMatches, ...multiLineMatches]);

    setTimeout(() => {
        editor.setDecorations(decorationType, []);
    }, 2000);
}

function findMatches(editor: vscode.TextEditor, regex: RegExp): vscode.Range[] {
    const document = editor.document;
    const matches: vscode.Range[] = [];
    let match;
    while ((match = regex.exec(document.getText()))) {
        const start = document.positionAt(match.index);
        const end = document.positionAt(match.index + match[0].length);
        matches.push(new vscode.Range(start, end));
    }
    return matches;
}

function removeCommentsFromEditor(editor: vscode.TextEditor, commentType: 'both' | 'single' | 'multi') {
    const document = editor.document;
    const text = document.getText();

    let cleanedText = text;

    const singleLineCommentRegex = /\/\/.*$/gm;
    const multiLineCommentRegex = /\/\*[\s\S]*?\*\//g;

    if (commentType === 'both' || commentType === 'single') {
        cleanedText = cleanedText.replace(singleLineCommentRegex, '');
    }

    if (commentType === 'both' || commentType === 'multi') {
        cleanedText = cleanedText.replace(multiLineCommentRegex, '');
    }

    const fullRange = new vscode.Range(
        document.positionAt(0),
        document.positionAt(text.length)
    );

    editor.edit(editBuilder => {
        editBuilder.replace(fullRange, cleanedText);
    });
}

export function deactivate() {
	if (pomodoroInterval) {
		clearInterval(pomodoroInterval);
	}
}

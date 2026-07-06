package com.moli.code.eclipse.actions;

import java.io.File;

import org.eclipse.core.resources.IResource;
import org.eclipse.jface.dialogs.InputDialog;
import org.eclipse.jface.dialogs.MessageDialog;
import org.eclipse.jface.window.Window;

/**
 * Commits reviewed changes: prompts for a commit message, then runs
 * `cvs -f commit -m <message> [file]`.
 */
public class CvsCommitAction extends AbstractCvsAction {

    protected void execute(IResource resource, File workingDir,
            String pathArg) {
        InputDialog dialog = new InputDialog(getShell(), "CVS 커밋",
                "커밋 메시지를 입력하세요 (커밋 전 diff로 변경 내용을 검토하는 것을 권장합니다):",
                "", null);
        if (dialog.open() != Window.OK) {
            return;
        }
        String message = dialog.getValue();
        if (message == null || message.trim().length() == 0) {
            MessageDialog.openInformation(getShell(), "몰리 코드",
                    "커밋 메시지가 비어 있어 커밋을 취소했습니다.");
            return;
        }
        CvsRunner.run(
                withPath(new String[] { "commit", "-m", message }, pathArg),
                workingDir, resource);
    }
}

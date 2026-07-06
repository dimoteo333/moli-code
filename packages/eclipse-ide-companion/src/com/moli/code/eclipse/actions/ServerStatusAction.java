package com.moli.code.eclipse.actions;

import java.io.File;

import org.eclipse.jface.action.IAction;
import org.eclipse.jface.dialogs.MessageDialog;
import org.eclipse.jface.viewers.ISelection;
import org.eclipse.ui.IWorkbenchWindow;
import org.eclipse.ui.IWorkbenchWindowActionDelegate;

import com.moli.code.eclipse.IdeServer;
import com.moli.code.eclipse.LockFileManager;
import com.moli.code.eclipse.MoliCodePlugin;

/** Shows whether the companion server is up and where its lock file lives. */
public class ServerStatusAction implements IWorkbenchWindowActionDelegate {

    private IWorkbenchWindow window;

    public void init(IWorkbenchWindow window) {
        this.window = window;
    }

    public void dispose() {
    }

    public void selectionChanged(IAction action, ISelection selection) {
    }

    public void run(IAction action) {
        MoliCodePlugin plugin = MoliCodePlugin.getDefault();
        IdeServer server = plugin == null ? null : plugin.getServer();
        StringBuffer sb = new StringBuffer();
        if (server == null || server.getPort() <= 0) {
            sb.append("몰리 코드 서버가 실행 중이지 않습니다.\n");
            sb.append("Eclipse를 다시 시작하거나 오류 로그를 확인하세요.");
        } else {
            sb.append("몰리 코드 서버 실행 중\n\n");
            sb.append("포트: 127.0.0.1:").append(server.getPort()).append('\n');
            sb.append("연결된 CLI 수: ").append(server.getClientCount())
                    .append('\n');
            LockFileManager lock = plugin.getLockFileManager();
            File lockFile = lock == null ? null : lock.getLockFile();
            if (lockFile != null) {
                sb.append("잠금 파일: ").append(lockFile.getAbsolutePath())
                        .append('\n');
            }
            sb.append('\n');
            sb.append("워크스페이스 안의 터미널에서 moli-code를 실행한 뒤 ");
            sb.append("/ide enable 을 입력하면 연결됩니다.");
        }
        MessageDialog.openInformation(window == null ? null : window
                .getShell(), "몰리 코드 연결 상태", sb.toString());
    }
}

package com.moli.code.eclipse.ui.handlers;

import com.moli.code.eclipse.ui.views.MoliChatView;
import org.eclipse.core.commands.AbstractHandler;
import org.eclipse.core.commands.ExecutionEvent;
import org.eclipse.core.commands.ExecutionException;
import org.eclipse.ui.IWorkbenchWindow;
import org.eclipse.ui.PlatformUI;

/**
 * 한국어 주석: 명령 팔레트/키 바인딩에서 Moli Code 채팅 뷰를 엽니다.
 */
public class OpenChatHandler extends AbstractHandler {
    @Override
    public Object execute(ExecutionEvent event) throws ExecutionException {
        IWorkbenchWindow window = PlatformUI.getWorkbench().getActiveWorkbenchWindow();
        if (window != null && window.getActivePage() != null) {
            try {
                window.getActivePage().showView(MoliChatView.ID);
            } catch (Exception ex) {
                throw new ExecutionException("Failed to open Moli Code chat view", ex);
            }
        }
        return null;
    }
}

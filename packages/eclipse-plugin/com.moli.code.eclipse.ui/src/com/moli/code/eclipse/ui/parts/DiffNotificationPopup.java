package com.moli.code.eclipse.ui.parts;

import com.moli.code.eclipse.core.Activator;
import org.eclipse.swt.SWT;
import org.eclipse.swt.layout.GridData;
import org.eclipse.swt.layout.GridLayout;
import org.eclipse.swt.widgets.Button;
import org.eclipse.swt.widgets.Composite;
import org.eclipse.swt.widgets.Display;
import org.eclipse.swt.widgets.Label;
import org.eclipse.swt.widgets.Shell;

/**
 * 한국어 주석: diff 제안에 대한 accept/reject 동작을 제공하는 간단한 팝업입니다.
 */
public class DiffNotificationPopup {
    private final Shell parent;
    private final String filePath;
    private Shell shell;

    public DiffNotificationPopup(Shell parent, String filePath) {
        this.parent = parent;
        this.filePath = filePath;
    }

    public void open() {
        Display display = parent == null ? Display.getDefault() : parent.getDisplay();
        shell = parent == null ? new Shell(display, SWT.TOOL | SWT.ON_TOP) : new Shell(parent, SWT.TOOL | SWT.ON_TOP);
        shell.setText("Moli Diff");
        shell.setLayout(new GridLayout(1, false));
        Composite area = new Composite(shell, SWT.NONE);
        area.setLayout(new GridLayout(2, false));
        area.setLayoutData(new GridData(SWT.FILL, SWT.FILL, true, true));

        Label label = new Label(area, SWT.WRAP);
        label.setText(filePath);
        GridData labelData = new GridData(SWT.FILL, SWT.CENTER, true, false);
        labelData.horizontalSpan = 2;
        label.setLayoutData(labelData);

        Button accept = new Button(area, SWT.PUSH);
        accept.setText("Accept");
        accept.addListener(SWT.Selection, event -> {
            Activator.getDefault().getDiffService().accept(filePath);
            close();
        });

        Button reject = new Button(area, SWT.PUSH);
        reject.setText("Reject");
        reject.addListener(SWT.Selection, event -> {
            Activator.getDefault().getDiffService().reject(filePath);
            close();
        });

        shell.pack();
        shell.open();
    }

    public void close() {
        if (shell != null && !shell.isDisposed()) {
            shell.dispose();
        }
    }
}

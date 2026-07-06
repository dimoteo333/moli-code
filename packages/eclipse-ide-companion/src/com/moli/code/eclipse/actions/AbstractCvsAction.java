package com.moli.code.eclipse.actions;

import java.io.File;

import org.eclipse.core.resources.IContainer;
import org.eclipse.core.resources.IResource;
import org.eclipse.core.runtime.IAdaptable;
import org.eclipse.core.runtime.IPath;
import org.eclipse.jface.action.IAction;
import org.eclipse.jface.dialogs.MessageDialog;
import org.eclipse.jface.viewers.ISelection;
import org.eclipse.jface.viewers.IStructuredSelection;
import org.eclipse.ui.IEditorInput;
import org.eclipse.ui.IEditorPart;
import org.eclipse.ui.IFileEditorInput;
import org.eclipse.ui.IObjectActionDelegate;
import org.eclipse.ui.IWorkbenchPart;
import org.eclipse.ui.IWorkbenchWindow;
import org.eclipse.ui.IWorkbenchWindowActionDelegate;
import org.eclipse.ui.PlatformUI;

/**
 * Base class for the CVS menu/context-menu actions. Resolves the target
 * resource from the current selection (Navigator / Package Explorer), falling
 * back to the file open in the active editor.
 *
 * Implements both delegate interfaces so a single class serves the main menu
 * (actionSets) and resource context menus (popupMenus) — the mechanisms that
 * exist in both Eclipse 3.2.2 and 4.7.3.
 */
public abstract class AbstractCvsAction implements
        IWorkbenchWindowActionDelegate, IObjectActionDelegate {

    private IWorkbenchWindow window;
    private IStructuredSelection selection;

    public void init(IWorkbenchWindow window) {
        this.window = window;
    }

    public void dispose() {
    }

    public void setActivePart(IAction action, IWorkbenchPart targetPart) {
        this.window = targetPart.getSite().getWorkbenchWindow();
    }

    public void selectionChanged(IAction action, ISelection newSelection) {
        if (newSelection instanceof IStructuredSelection) {
            this.selection = (IStructuredSelection) newSelection;
        }
    }

    public final void run(IAction action) {
        IResource resource = resolveTargetResource();
        if (resource == null) {
            MessageDialog.openInformation(getShell(), "몰리 코드",
                    "CVS 작업을 수행할 파일 또는 프로젝트를 먼저 선택하세요.");
            return;
        }
        IPath location = resource.getLocation();
        if (location == null) {
            MessageDialog.openInformation(getShell(), "몰리 코드",
                    "선택한 리소스의 로컬 경로를 찾을 수 없습니다.");
            return;
        }

        File workingDir;
        String pathArg;
        if (resource instanceof IContainer) {
            workingDir = location.toFile();
            pathArg = null;
        } else {
            workingDir = location.toFile().getParentFile();
            pathArg = location.toFile().getName();
        }
        execute(resource, workingDir, pathArg);
    }

    /**
     * @param resource   the selected resource (for refresh after the command)
     * @param workingDir directory to run cvs in
     * @param pathArg    file name argument, or null when operating on a
     *                   directory
     */
    protected abstract void execute(IResource resource, File workingDir,
            String pathArg);

    protected final org.eclipse.swt.widgets.Shell getShell() {
        if (window != null) {
            return window.getShell();
        }
        return PlatformUI.getWorkbench().getActiveWorkbenchWindow() != null
                ? PlatformUI.getWorkbench().getActiveWorkbenchWindow()
                        .getShell()
                : null;
    }

    static String[] withPath(String[] args, String pathArg) {
        if (pathArg == null) {
            return args;
        }
        String[] extended = new String[args.length + 1];
        System.arraycopy(args, 0, extended, 0, args.length);
        extended[args.length] = pathArg;
        return extended;
    }

    private IResource resolveTargetResource() {
        if (selection != null && !selection.isEmpty()) {
            Object element = selection.getFirstElement();
            if (element instanceof IResource) {
                return (IResource) element;
            }
            if (element instanceof IAdaptable) {
                IResource adapted = (IResource) ((IAdaptable) element)
                        .getAdapter(IResource.class);
                if (adapted != null) {
                    return adapted;
                }
            }
        }
        // Fall back to the active editor's file.
        IWorkbenchWindow activeWindow = window != null ? window : PlatformUI
                .getWorkbench().getActiveWorkbenchWindow();
        if (activeWindow != null && activeWindow.getActivePage() != null) {
            IEditorPart editor = activeWindow.getActivePage()
                    .getActiveEditor();
            if (editor != null) {
                IEditorInput input = editor.getEditorInput();
                if (input instanceof IFileEditorInput) {
                    return ((IFileEditorInput) input).getFile();
                }
            }
        }
        return null;
    }
}

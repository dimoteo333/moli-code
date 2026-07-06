package com.moli.code.eclipse.actions;

import java.io.File;

import org.eclipse.core.resources.IResource;

/** Shows local modifications: `cvs -f diff -u [file]`. */
public class CvsDiffAction extends AbstractCvsAction {

    protected void execute(IResource resource, File workingDir,
            String pathArg) {
        CvsRunner.run(withPath(new String[] { "diff", "-u" }, pathArg),
                workingDir, null);
    }
}

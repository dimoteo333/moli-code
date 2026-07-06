package com.moli.code.eclipse.actions;

import java.io.File;

import org.eclipse.core.resources.IResource;

/** Syncs the workspace: `cvs -f update -d -P [file]`. */
public class CvsUpdateAction extends AbstractCvsAction {

    protected void execute(IResource resource, File workingDir,
            String pathArg) {
        CvsRunner.run(
                withPath(new String[] { "update", "-d", "-P" }, pathArg),
                workingDir, resource);
    }
}

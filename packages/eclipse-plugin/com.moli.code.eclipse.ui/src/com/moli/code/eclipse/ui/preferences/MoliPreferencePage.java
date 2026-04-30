package com.moli.code.eclipse.ui.preferences;

import com.moli.code.eclipse.core.Activator;
import org.eclipse.jface.preference.BooleanFieldEditor;
import org.eclipse.jface.preference.DirectoryFieldEditor;
import org.eclipse.jface.preference.FieldEditorPreferencePage;
import org.eclipse.jface.preference.FileFieldEditor;
import org.eclipse.jface.preference.RadioGroupFieldEditor;
import org.eclipse.jface.preference.StringFieldEditor;
import org.eclipse.ui.IWorkbench;
import org.eclipse.ui.IWorkbenchPreferencePage;

/**
 * 한국어 주석: Window > Preferences > Moli Code 설정 페이지입니다.
 */
public class MoliPreferencePage extends FieldEditorPreferencePage implements IWorkbenchPreferencePage {
    public MoliPreferencePage() {
        super(GRID);
        setPreferenceStore(Activator.getDefault().getPreferenceStore());
        setDescription("Moli Code Eclipse integration settings");
    }

    @Override
    public void init(IWorkbench workbench) {
        // 한국어 주석: workbench 인스턴스는 현재 설정 페이지에서 별도로 필요하지 않습니다.
    }

    @Override
    protected void createFieldEditors() {
        addField(new FileFieldEditor(Activator.PREF_NODE_PATH, "Node executable", getFieldEditorParent()));
        addField(new DirectoryFieldEditor(Activator.PREF_MOLI_CODE_PATH, "Moli Code directory", getFieldEditorParent()));
        addField(new StringFieldEditor(Activator.PREF_DEFAULT_MODEL, "Default model", getFieldEditorParent()));
        addField(new RadioGroupFieldEditor(Activator.PREF_AUTH_TYPE, "Authentication", 1,
                new String[][] {{"Moli OAuth", "moli-oauth"}, {"OpenAI", "openai"}, {"Gemini", "gemini"},
                        {"Vertex AI", "vertex-ai"}, {"Anthropic", "anthropic"}}, getFieldEditorParent()));
        addField(new BooleanFieldEditor(Activator.PREF_ENABLE_PROXY, "Use proxy", getFieldEditorParent()));
        addField(new StringFieldEditor(Activator.PREF_PROXY_URL, "Proxy URL", getFieldEditorParent()));
    }
}

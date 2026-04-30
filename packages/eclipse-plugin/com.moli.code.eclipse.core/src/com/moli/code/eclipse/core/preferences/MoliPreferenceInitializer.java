package com.moli.code.eclipse.core.preferences;

import com.moli.code.eclipse.core.Activator;
import org.eclipse.core.runtime.preferences.AbstractPreferenceInitializer;
import org.eclipse.jface.preference.IPreferenceStore;

/**
 * 한국어 주석: Moli Code Eclipse 플러그인의 기본 설정값을 등록합니다.
 */
public class MoliPreferenceInitializer extends AbstractPreferenceInitializer {
    @Override
    public void initializeDefaultPreferences() {
        IPreferenceStore store = Activator.getDefault().getPreferenceStore();
        store.setDefault(Activator.PREF_NODE_PATH, "node");
        store.setDefault(Activator.PREF_MOLI_CODE_PATH, System.getProperty("user.dir", ""));
        store.setDefault(Activator.PREF_DEFAULT_MODEL, "");
        store.setDefault(Activator.PREF_AUTH_TYPE, "moli-oauth");
        store.setDefault(Activator.PREF_PROXY_URL, "");
        store.setDefault(Activator.PREF_ENABLE_PROXY, false);
    }
}

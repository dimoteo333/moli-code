package com.moli.code.eclipse.core.diff;

import com.moli.code.eclipse.core.util.Java8Compat;
import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.lang.reflect.InvocationTargetException;
import java.nio.charset.StandardCharsets;
import org.eclipse.compare.CompareConfiguration;
import org.eclipse.compare.CompareEditorInput;
import org.eclipse.compare.IEditableContent;
import org.eclipse.compare.IEncodedStreamContentAccessor;
import org.eclipse.compare.ITypedElement;
import org.eclipse.compare.structuremergeviewer.DiffNode;
import org.eclipse.core.runtime.IProgressMonitor;
import org.eclipse.swt.graphics.Image;

/**
 * 한국어 주석: Eclipse Compare API에 원본과 수정안을 문자열 문서로 공급하는 입력 객체입니다.
 */
public class MoliCompareInput extends CompareEditorInput {
    private final String filePath;
    private final EditableTextElement left;
    private final EditableTextElement right;

    public MoliCompareInput(String filePath, String oldContent, String newContent) {
        super(createConfiguration(filePath));
        this.filePath = filePath;
        this.left = new EditableTextElement("Original", oldContent, false);
        this.right = new EditableTextElement("Moli Proposal", newContent, true);
        setTitle("Moli Diff - " + filePath);
    }

    public String getFilePath() {
        return filePath;
    }

    public String getModifiedContent() {
        return right.getContent();
    }

    @Override
    protected Object prepareInput(IProgressMonitor monitor) throws InvocationTargetException, InterruptedException {
        return new DiffNode(left, right);
    }

    private static CompareConfiguration createConfiguration(String filePath) {
        CompareConfiguration configuration = new CompareConfiguration();
        configuration.setLeftLabel("Original");
        configuration.setRightLabel("Moli Proposal");
        return configuration;
    }

    /**
     * 한국어 주석: Compare 에디터가 읽고, 오른쪽 수정안은 편집할 수 있는 문자열 element입니다.
     */
    private static class EditableTextElement implements ITypedElement, IEncodedStreamContentAccessor, IEditableContent {
        private final String name;
        private final boolean editable;
        private String content;

        EditableTextElement(String name, String content, boolean editable) {
            this.name = name;
            this.content = content == null ? "" : content;
            this.editable = editable;
        }

        @Override
        public String getName() {
            return name;
        }

        @Override
        public Image getImage() {
            return null;
        }

        @Override
        public String getType() {
            return ITypedElement.TEXT_TYPE;
        }

        @Override
        public InputStream getContents() {
            return new ByteArrayInputStream(content.getBytes(StandardCharsets.UTF_8));
        }

        @Override
        public String getCharset() {
            return StandardCharsets.UTF_8.name();
        }

        @Override
        public boolean isEditable() {
            return editable;
        }

        @Override
        public ITypedElement replace(ITypedElement dest, ITypedElement src) {
            if (editable && src instanceof IEncodedStreamContentAccessor) {
                IEncodedStreamContentAccessor accessor = (IEncodedStreamContentAccessor) src;
                try (InputStream stream = accessor.getContents()) {
                    content = new String(Java8Compat.readAllBytes(stream), StandardCharsets.UTF_8);
                } catch (Exception ignored) {
                    // 한국어 주석: Compare 내부 편집 반영 실패는 기존 내용을 유지합니다.
                }
            }
            return this;
        }

        @Override
        public void setContent(byte[] newContent) {
            if (editable && newContent != null) {
                content = new String(newContent, StandardCharsets.UTF_8);
            }
        }

        String getContent() {
            return content;
        }
    }
}

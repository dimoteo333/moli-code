package com.alibaba.moli.code.cli;

import java.util.List;

import com.alibaba.moli.code.cli.transport.TransportOptions;

import org.junit.jupiter.api.Test;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import static org.junit.jupiter.api.Assertions.*;

class MoliCodeCliTest {

    private static final Logger log = LoggerFactory.getLogger(MoliCodeCliTest.class);
    @Test
    void simpleQuery() {
        List<String> result = MoliCodeCli.simpleQuery("hello world");
        log.info("simpleQuery result: {}", result);
        assertNotNull(result);
    }

    @Test
    void simpleQueryWithModel() {
        List<String> result = MoliCodeCli.simpleQuery("hello world", new TransportOptions().setModel("moli-plus"));
        log.info("simpleQueryWithModel result: {}", result);
        assertNotNull(result);
    }
}

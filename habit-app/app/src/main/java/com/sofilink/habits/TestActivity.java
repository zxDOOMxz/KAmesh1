package com.sofilink.habits;

import android.app.Activity;
import android.graphics.Color;
import android.os.Bundle;
import android.widget.LinearLayout;
import android.widget.TextView;

public class TestActivity extends Activity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setBackgroundColor(Color.WHITE);
        root.setPadding(32, 32, 32, 32);

        TextView tv = new TextView(this);
        tv.setText("Hello World!\nЕсли видите это — приложение работает.");
        tv.setTextSize(20);
        tv.setTextColor(Color.BLACK);

        root.addView(tv);
        setContentView(root);
    }
}

# ---------------------------------------------------------------------------
# Reglas ProGuard para la APK de release — GGTO Técnico
# ---------------------------------------------------------------------------
# Se aplica cuando `minifyEnabled = true` en build.gradle (H-35).
# Flutter ya incluye sus propias reglas; estas protegen las dependencias
# que usan reflexión o serialización JSON.

# ---- Flutter / Dart -------------------------------------------------------
-keep class io.flutter.** { *; }
-keep class com.example.ggto_tecnico.** { *; }

# ---- Dio (HTTP) ------------------------------------------------------------
-dontwarn okhttp3.**
-dontwarn okio.**
-dontwarn javax.annotation.**
-keepattributes Signature
-keepattributes Exceptions
-keepclassmembers,allowshrinking,allowobfuscation interface * {
    @dio.http.* <methods>;
}

# ---- Provider / ChangeNotifier ---------------------------------------------
-keepclassmembers class * extends android.app.Activity {
    public *(android.view.View);
}

# ---- sqflite (SQLite) ------------------------------------------------------
-keep class io.flutter.plugins.pathprovider.** { *; }
-keep class io.flutter.plugins.sharedpreferences.** { *; }

# ---- image_picker / geolocator ---------------------------------------------
-keep class io.flutter.plugins.imagepicker.** { *; }
-keep class com.baseflow.geolocator.** { *; }
-dontwarn com.google.android.gms.location.**
-keep class com.google.android.gms.common.** { *; }
-keep class com.google.android.gms.location.** { *; }

# ---- flutter_secure_storage ------------------------------------------------
-keep class com.amazonaws.mobile.client.** { *; }
-keep class com.amazonaws.auth.** { *; }
-dontwarn com.amazonaws.**

# ---- share_plus -----------------------------------------------------------
-keep class com.shraddha.** { *; }
-dontwarn com.shraddha.**

# ---- archive (ZIP) ---------------------------------------------------------
-keep class org.apache.commons.compress.** { *; }
-dontwarn org.bouncycastle.**
-keep class org.bouncycastle.** { *; }

# ---- General ---------------------------------------------------------------
# Mantener los nombres de clases usadas por reflection (JSON deserialization, etc.)
-keepattributes *Annotation*, SourceFile, LineNumberTable
-keepclassmembers class * implements java.io.Serializable {
    static final long serialVersionUID;
    private static final java.io.ObjectStreamField[] serialPersistentFields;
    private void writeObject(java.io.ObjectOutputStream);
    private void readObject(java.io.ObjectInputStream);
    java.lang.Object writeReplace();
    java.lang.Object readResolve();
}

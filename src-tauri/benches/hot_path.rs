use criterion::{black_box, criterion_group, criterion_main, Criterion};
use smoothscroll_core::engine::SmoothScrollEngine;
use smoothscroll_core::input_source::InputSource;
use smoothscroll_core::settings::{AppSettings, EffectiveSettings, ScrollProfile};
use std::collections::HashMap;
use std::sync::Arc;

fn default_eff() -> EffectiveSettings {
    EffectiveSettings::from_settings(&AppSettings::default())
}

fn profile_eff() -> EffectiveSettings {
    let profile = ScrollProfile::new("bench-profile", "Bench Profile");
    EffectiveSettings::with_profile(&AppSettings::default(), &profile)
}

fn bench_resolve_active_no_profiles(c: &mut Criterion) {
    let eff = arc_swap::ArcSwap::from_pointee(default_eff());

    c.bench_function("resolve_active_no_profiles", |b| {
        b.iter(|| {
            black_box(eff.load_full());
        });
    });
}

fn bench_profile_lookup(c: &mut Criterion) {
    let profile_eff = Arc::new(profile_eff());
    let mut map: HashMap<String, Arc<EffectiveSettings>> = HashMap::new();
    for i in 0..10 {
        map.insert(format!("profile-{}", i), profile_eff.clone());
    }
    let global_eff = Arc::new(default_eff());

    c.bench_function("profile_lookup_hit_10", |b| {
        b.iter(|| {
            black_box(
                map.get("profile-5")
                    .cloned()
                    .unwrap_or_else(|| global_eff.clone()),
            );
        });
    });

    c.bench_function("profile_lookup_miss_10", |b| {
        b.iter(|| {
            black_box(
                map.get("nonexistent")
                    .cloned()
                    .unwrap_or_else(|| global_eff.clone()),
            );
        });
    });
}

fn bench_route_vertical_inline(c: &mut Criterion) {
    let mut engine = SmoothScrollEngine::new();
    let eff = default_eff();
    let source = InputSource::Wheel;

    c.bench_function("engine_on_wheel_with_source", |b| {
        b.iter(|| {
            engine.on_wheel_with_source(black_box(120), black_box(0), black_box(source), &eff);
        });
    });
}

fn bench_step_small_pending(c: &mut Criterion) {
    let mut engine = SmoothScrollEngine::new();
    let eff = default_eff();
    engine.on_wheel_with_source(120, 0, InputSource::Wheel, &eff);

    c.bench_function("step_small_pending", |b| {
        b.iter(|| {
            black_box(engine.step(black_box(8.33), &eff));
        });
    });
}

fn bench_step_large_pending(c: &mut Criterion) {
    let mut engine = SmoothScrollEngine::new();
    let eff = default_eff();
    for i in 0..20 {
        engine.on_wheel_with_source(120, i * 10, InputSource::Wheel, &eff);
    }

    c.bench_function("step_large_pending", |b| {
        b.iter(|| {
            black_box(engine.step(black_box(8.33), &eff));
        });
    });
}

fn bench_on_wheel_touchpad(c: &mut Criterion) {
    let mut engine = SmoothScrollEngine::new();
    let eff = default_eff();

    c.bench_function("on_wheel_touchpad", |b| {
        b.iter(|| {
            engine.on_wheel_with_source(
                black_box(30),
                black_box(0),
                black_box(InputSource::Touchpad),
                &eff,
            );
        });
    });
}

criterion_group!(
    benches,
    bench_resolve_active_no_profiles,
    bench_profile_lookup,
    bench_route_vertical_inline,
    bench_step_small_pending,
    bench_step_large_pending,
    bench_on_wheel_touchpad,
);
criterion_main!(benches);

use criterion::{black_box, criterion_group, criterion_main, Criterion};
use smoothscroll_core::engine::SmoothScrollEngine;
use smoothscroll_core::input_source::InputSource;
use smoothscroll_core::settings::{AppSettings, EffectiveSettings};

fn default_effective() -> EffectiveSettings {
    EffectiveSettings::from_settings(&AppSettings::default())
}

fn bench_on_wheel_with_source(c: &mut Criterion) {
    let mut engine = SmoothScrollEngine::new();
    let eff = default_effective();
    let source = InputSource::Wheel;

    c.bench_function("on_wheel_with_source", |b| {
        b.iter(|| {
            engine.on_wheel_with_source(black_box(120), black_box(0), black_box(source), &eff);
        });
    });
}

fn bench_step_small_delta(c: &mut Criterion) {
    let mut engine = SmoothScrollEngine::new();
    let eff = default_effective();
    engine.on_wheel_with_source(120, 0, InputSource::Wheel, &eff);

    c.bench_function("step_small_delta", |b| {
        b.iter(|| {
            black_box(engine.step(black_box(8.33), &eff));
        });
    });
}

fn bench_step_large_delta(c: &mut Criterion) {
    let mut engine = SmoothScrollEngine::new();
    let eff = default_effective();
    for i in 0..10 {
        engine.on_wheel_with_source(120, i * 10, InputSource::Wheel, &eff);
    }

    c.bench_function("step_large_delta", |b| {
        b.iter(|| {
            black_box(engine.step(black_box(8.33), &eff));
        });
    });
}

fn bench_on_wheel_touchpad(c: &mut Criterion) {
    let mut engine = SmoothScrollEngine::new();
    let eff = default_effective();

    c.bench_function("on_wheel_with_source_touchpad", |b| {
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
    bench_on_wheel_with_source,
    bench_step_small_delta,
    bench_step_large_delta,
    bench_on_wheel_touchpad
);
criterion_main!(benches);

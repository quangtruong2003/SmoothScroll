use criterion::{black_box, criterion_group, criterion_main, BenchmarkId, Criterion};
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

fn bench_rapid_direction_change(c: &mut Criterion) {
    c.bench_function("engine_rapid_direction_change", |b| {
        b.iter(|| {
            let mut engine = SmoothScrollEngine::new();
            let eff = default_effective();
            for i in 0..10 {
                engine.on_wheel_with_source(120, i * 20, InputSource::Wheel, &eff);
            }
            for i in 0..5 {
                engine.on_wheel_with_source(-120, 200 + i * 20, InputSource::Wheel, &eff);
            }
            for _ in 0..30 {
                engine.step(8.33, &eff);
            }
            black_box(());
        });
    });
}

fn bench_multi_axis_simultaneous(c: &mut Criterion) {
    c.bench_function("engine_multi_axis_simultaneous", |b| {
        b.iter(|| {
            let mut engine = SmoothScrollEngine::new();
            let eff = default_effective();
            for i in 0..10 {
                engine.on_wheel_with_source(120, i * 20, InputSource::Wheel, &eff);
            }
            for i in 0..5 {
                engine.on_hwheel_with_source(120, i * 20, InputSource::Wheel, &eff);
            }
            for _ in 0..30 {
                engine.step(8.33, &eff);
            }
            black_box(());
        });
    });
}

fn bench_long_idle_recovery(c: &mut Criterion) {
    c.bench_function("engine_long_idle_recovery", |b| {
        b.iter(|| {
            let mut engine = SmoothScrollEngine::new();
            let eff = default_effective();
            for i in 0..20 {
                engine.on_wheel_with_source(120, i * 20, InputSource::Wheel, &eff);
            }
            for _ in 0..360 {
                engine.step(8.33, &eff);
            }
            engine.on_wheel_with_source(120, 3000, InputSource::Wheel, &eff);
            let out = engine.step(8.33, &eff);
            black_box(out.vertical);
        });
    });
}

fn bench_high_frequency_burst(c: &mut Criterion) {
    c.bench_function("engine_high_freq_burst", |b| {
        b.iter(|| {
            let mut engine = SmoothScrollEngine::new();
            let eff = default_effective();
            for i in 0..100 {
                engine.on_wheel_with_source(120, i as u64, InputSource::Wheel, &eff);
            }
            for _ in 0..60 {
                engine.step(8.33, &eff);
            }
            black_box(());
        });
    });
}

fn bench_easing_accuracy(c: &mut Criterion) {
    use smoothscroll_core::easing::compute_easing_fraction;
    use smoothscroll_core::easing::EasingMode;
    let modes = [
        EasingMode::Linear,
        EasingMode::CubicOut,
        EasingMode::QuinticOut,
        EasingMode::ExponentialOut,
    ];
    for mode in &modes {
        c.bench_with_input(
            BenchmarkId::new("easing_accuracy", format!("{:?}", mode)),
            mode,
            |b, mode| {
                b.iter(|| {
                    let v0 = compute_easing_fraction(0.0, 100.0, *mode, 5.0, true);
                    let v1 = compute_easing_fraction(100.0, 100.0, *mode, 5.0, true);
                    let v_mid = compute_easing_fraction(50.0, 100.0, *mode, 5.0, true);
                    assert!((v0 - 0.0).abs() < 0.001);
                    assert!((v1 - 1.0).abs() < 0.001);
                    // Ease-out curves reach high fractions early —
                    // mid values exceed 0.5 for all non-linear modes.
                    assert!(v_mid > 0.0 && v_mid < 1.0);
                });
            },
        );
    }
}

criterion_group!(
    benches,
    bench_on_wheel_with_source,
    bench_step_small_delta,
    bench_step_large_delta,
    bench_on_wheel_touchpad,
    bench_rapid_direction_change,
    bench_multi_axis_simultaneous,
    bench_long_idle_recovery,
    bench_high_frequency_burst,
    bench_easing_accuracy
);
criterion_main!(benches);

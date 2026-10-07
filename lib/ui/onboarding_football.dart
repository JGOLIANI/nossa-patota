import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'design_system.dart';

/// The whole illustrated CTA remains a single accessible, tappable button.
class FootballContinueButton extends StatefulWidget {
  const FootballContinueButton({
    super.key,
    required this.progress,
    required this.label,
    required this.onPressed,
    this.loading = false,
    this.goalCelebration,
  });
  final double? progress;
  final String label;
  final VoidCallback? onPressed;
  final bool loading;
  final int? goalCelebration;

  @override
  State<FootballContinueButton> createState() => _FootballContinueState();
}

class _FootballContinueState extends State<FootballContinueButton>
    with SingleTickerProviderStateMixin {
  late final marquee = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 2200),
  );

  @override
  void initState() {
    super.initState();
    marquee.addStatusListener((_) {
      if (mounted) setState(() {});
    });
  }

  @override
  void didUpdateWidget(FootballContinueButton oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.loading || widget.onPressed == null) {
      marquee.stop();
    } else if (widget.goalCelebration != oldWidget.goalCelebration &&
        (widget.goalCelebration ?? 0) > 0 &&
        !MediaQuery.disableAnimationsOf(context)) {
      marquee.forward(from: 0);
    }
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (MediaQuery.disableAnimationsOf(context)) marquee.stop();
  }

  @override
  void dispose() {
    marquee.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => PrimaryButton(
    label: widget.label,
    icon: Icons.arrow_forward_rounded,
    loading: widget.loading,
    onPressed: widget.onPressed,
    background: widget.progress == null
        ? widget.goalCelebration == null
              ? null
              : const SizedBox.expand()
        : Opacity(
            opacity: .4,
            child: FootballPlayAnimation(progress: widget.progress!),
          ),
    labelOverlay: marquee.isAnimating
        ? RepaintBoundary(
            child: CustomPaint(
              key: const ValueKey('goal-marquee'),
              painter: GoalMarqueePainter(
                animation: marquee,
                color: Theme.of(context).colorScheme.onPrimary,
                fontSize: MediaQuery.textScalerOf(
                  context,
                ).scale(32).clamp(32, 48),
              ),
            ),
          )
        : null,
  );
}

/// A finite scoreboard marquee. Repaints only the decorative overlay, while
/// the underlying button retains its action name, size and click target.
class GoalMarqueePainter extends CustomPainter {
  GoalMarqueePainter({
    required this.animation,
    required this.color,
    required this.fontSize,
  }) : super(repaint: animation);
  final Animation<double> animation;
  final Color color;
  final double fontSize;
  double get progress => animation.value;

  @override
  void paint(Canvas canvas, Size size) {
    final text = TextPainter(
      text: TextSpan(
        text: 'GOOOOOLLL!',
        style: TextStyle(
          fontFamily: 'Inter',
          fontSize: fontSize,
          fontWeight: FontWeight.w900,
          letterSpacing: 2.5,
          color: color,
        ),
      ),
      textDirection: TextDirection.ltr,
    )..layout();
    canvas.save();
    canvas.clipRect(Offset.zero & size);
    text.paint(
      canvas,
      Offset(
        size.width - (size.width + text.width) * progress,
        (size.height - text.height) / 2,
      ),
    );
    canvas.restore();
    text.dispose();
  }

  @override
  bool shouldRepaint(GoalMarqueePainter oldDelegate) =>
      oldDelegate.animation != animation ||
      oldDelegate.color != color ||
      oldDelegate.fontSize != fontSize;
}

/// Continuous interpolation follows the display's refresh rate. Each step
/// plays a finite part of the move, then holds. Going back rewinds it.
class FootballPlayAnimation extends StatefulWidget {
  const FootballPlayAnimation({super.key, required this.progress});
  final double progress;
  @override
  State<FootballPlayAnimation> createState() => _FootballState();
}

class _FootballState extends State<FootballPlayAnimation>
    with SingleTickerProviderStateMixin {
  late final AnimationController clock = AnimationController(vsync: this);
  final frame = ValueNotifier<double>(0);
  double from = 0, target = 0;
  bool? reducedMotion;

  double get destination => 6 + widget.progress.clamp(0.0, 1.0) * 54;

  @override
  void initState() {
    super.initState();
    // A restored draft plays only the current part of the move.
    frame.value = math.max(0, destination - 10);
    clock.addListener(tick);
  }

  void tick() {
    frame.value =
        from + (target - from) * Curves.easeInOutCubic.transform(clock.value);
  }

  void play() {
    clock.stop();
    target = destination;
    if (reducedMotion == true) {
      frame.value = target;
      return;
    }
    from = frame.value;
    if (from == target) return;
    clock.duration = Duration(
      milliseconds: ((target - from).abs() * 90).round().clamp(550, 1400),
    );
    clock.forward(from: 0);
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final reduced = MediaQuery.disableAnimationsOf(context);
    if (reducedMotion != reduced) {
      reducedMotion = reduced;
      play();
    }
  }

  @override
  void didUpdateWidget(FootballPlayAnimation oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.progress != widget.progress) play();
  }

  @override
  void dispose() {
    clock.dispose();
    frame.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return RepaintBoundary(
      child: ValueListenableBuilder<double>(
        valueListenable: frame,
        builder: (context, value, _) => CustomPaint(
          key: const ValueKey('onboarding-football-scene'),
          painter: FootballPlayPainter(
            frame: value,
            field: scheme.onPrimary.withValues(alpha: .13),
            ink: scheme.onPrimary,
            shirt: Theme.of(context).brightness == Brightness.dark
                ? scheme.primaryContainer
                : PatotaColors.warning,
            paper: scheme.primary,
            shadow: Colors.black,
          ),
        ),
      ),
    );
  }
}

class FootballPlayPainter extends CustomPainter {
  FootballPlayPainter({
    required this.frame,
    required this.field,
    required this.ink,
    required this.shirt,
    required this.paper,
    required this.shadow,
  });
  final double frame;
  final Color field, ink, shirt, paper, shadow;
  bool get scored => frame >= 55;

  double phase(int start, int end) =>
      ((frame - start) / (end - start)).clamp(0.0, 1.0);
  double mix(double a, double b, double t) => a + (b - a) * t;

  @override
  void paint(Canvas canvas, Size size) {
    final width = math.min(size.width - 8, 640.0);
    final height = math.min(size.height - 4, width * .38);
    if (width <= 0 || height <= 0) return;
    final scene = Rect.fromLTWH(
      (size.width - width) / 2,
      size.height - height - 2,
      width,
      height,
    );
    canvas.save();
    canvas.translate(scene.left, scene.top);
    canvas.scale(width, height);

    // Keep the field quiet against the button's primary colour.
    final line = Paint()
      ..color = ink.withValues(alpha: .12)
      ..style = PaintingStyle.stroke
      ..strokeWidth = .004;
    canvas.drawRRect(
      RRect.fromRectAndRadius(
        const Rect.fromLTWH(0, .31, 1, .65),
        const Radius.circular(.035),
      ),
      Paint()..color = field,
    );
    for (var i = 0; i < 5; i++) {
      canvas.drawRect(
        Rect.fromLTWH(i * .2, .35, .1, .56),
        Paint()..color = ink.withValues(alpha: .025),
      );
    }
    canvas.drawLine(const Offset(.03, .9), const Offset(.97, .9), line);
    canvas.drawLine(const Offset(.48, .34), const Offset(.48, .9), line);
    canvas.drawOval(const Rect.fromLTWH(.38, .46, .2, .34), line);

    // Rear net, then the actors and ball, then the front goal posts.
    net(canvas, width, height);
    final dribble = phase(20, 36), run = phase(36, 44), shot = phase(45, 55);
    final runner = mix(.4, .62, dribble) + .08 * run;
    final gait = math.sin(frame * math.pi / 3);
    player(
      canvas,
      width,
      height,
      .15 + .06 * phase(0, 10),
      .81,
      ink,
      stride: gait * math.sin(math.pi * phase(0, 12)),
      kick: math.sin(math.pi * phase(8, 17)),
      celebrate: phase(55, 60),
    );
    player(
      canvas,
      width,
      height,
      runner,
      .83,
      ink,
      stride: gait * math.sin(math.pi * phase(20, 43)),
      kick: math.sin(math.pi * phase(40, 54)),
      celebrate: phase(55, 60),
    );
    player(
      canvas,
      width,
      height,
      mix(.67, .53, phase(22, 38)),
      mix(.72, .83, phase(30, 42)),
      shirt,
      stride: -gait * math.sin(math.pi * phase(22, 43)),
    );
    player(
      canvas,
      width,
      height,
      .865 - .075 * shot,
      .8 + .06 * shot,
      shirt,
      stride: 0,
      goalkeeper: true,
      dive: shot,
    );

    Offset ball;
    if (frame <= 10) {
      ball = Offset(.19 + .055 * phase(0, 10), .82);
    } else if (frame <= 20) {
      final pass = phase(10, 20);
      ball = Offset(
        mix(.245, .435, pass),
        .82 - .23 * math.sin(pass * math.pi),
      );
    } else if (frame <= 45) {
      ball = Offset(
        runner + .04,
        .83 - .025 * gait.abs() * math.sin(math.pi * phase(20, 44)),
      );
    } else if (frame < 55) {
      ball = Offset(
        mix(.74, .945, shot),
        mix(.83, .55, shot) - .16 * math.sin(shot * math.pi),
      );
      // Subtle traces follow the shot while keeping the ball crisp.
      for (var i = 1; i <= 3; i++) {
        canvas.drawLine(
          Offset(ball.dx - .012 * i, ball.dy + .018 * i),
          Offset(ball.dx - .018 * i, ball.dy + .025 * i),
          line..color = ink.withValues(alpha: .18),
        );
      }
    } else {
      ball = Offset(
        .945 - .008 * math.sin((frame - 55) * 1.3) * (1 - phase(55, 60)),
        .55 + .018 * phase(55, 60),
      );
    }
    football(canvas, width, height, ball);
    goalPosts(canvas);

    if (scored) {
      // Fade in the final goal without flashing or looping.
      canvas.save();
      canvas.scale(1 / width, 1 / height);
      final text = TextPainter(
        text: TextSpan(
          text: 'GOL!',
          style: TextStyle(
            color: ink.withValues(alpha: phase(55, 57)),
            fontFamily: 'Inter',
            fontSize: math.min(height * .14, 18),
            fontWeight: FontWeight.w900,
          ),
        ),
        textDirection: TextDirection.ltr,
      )..layout();
      text.paint(canvas, Offset(width * .87 - text.width / 2, 0));
      canvas.restore();
    }
    canvas.restore();
  }

  void net(Canvas canvas, double width, double height) {
    final ripple = scored
        ? .01 * math.sin((frame - 55) * 1.6) * (1 - phase(55, 60))
        : 0.0;
    final mesh = Paint()
      ..color = ink.withValues(alpha: .2)
      ..style = PaintingStyle.stroke
      ..strokeWidth = .002;
    final back = Path()
      ..moveTo(.88, .17)
      ..lineTo(.99 + ripple, .28)
      ..lineTo(.99 + ripple, .8)
      ..lineTo(.88, .69)
      ..close();
    canvas.drawPath(back, Paint()..color = paper.withValues(alpha: .1));
    canvas.drawPath(back, mesh);
    for (var i = 1; i < 6; i++) {
      final x = .88 + i * .11 / 6;
      canvas.drawLine(
        Offset(x, .17 + i * .11 / 6),
        Offset(x + ripple, .69 + i * .11 / 6),
        mesh,
      );
      final y = .17 + i * .52 / 6;
      canvas.drawLine(Offset(.88, y), Offset(.99 + ripple, y + .11), mesh);
    }
  }

  void goalPosts(Canvas canvas) {
    final paint = Paint()
      ..color = ink.withValues(alpha: .72)
      ..style = PaintingStyle.stroke
      ..strokeWidth = .006
      ..strokeCap = StrokeCap.round;
    canvas.drawPath(
      Path()
        ..moveTo(.88, .7)
        ..lineTo(.88, .17)
        ..lineTo(.99, .28)
        ..lineTo(.99, .81),
      paint,
    );
  }

  void player(
    Canvas canvas,
    double width,
    double height,
    double x,
    double ground,
    Color kit, {
    required double stride,
    double kick = 0,
    double celebrate = 0,
    bool goalkeeper = false,
    double dive = 0,
  }) {
    // Paint humans in pixel coordinates to preserve proportions on every screen.
    canvas.save();
    canvas.scale(1 / width, 1 / height);
    final unit = height * .34;
    canvas.translate(x * width, ground * height - stride.abs() * unit * .05);
    canvas.drawOval(
      Rect.fromCenter(
        center: Offset(0, unit * .035),
        width: unit * .65,
        height: unit * .12,
      ),
      Paint()..color = shadow.withValues(alpha: .1),
    );
    if (dive > 0) canvas.rotate(-dive * 1.1);
    final limb = Paint()
      ..color = ink.withValues(alpha: .85)
      ..style = PaintingStyle.stroke
      ..strokeWidth = unit * .1
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round;
    final hip = Offset(0, -unit * .4);
    final frontFoot = Offset(
      mix(unit * .23 * stride, unit * .48, kick),
      -unit * .16 * kick,
    );
    final backFoot = Offset(-unit * .2 * stride - unit * .12 * kick, 0);
    canvas.drawPath(
      Path()
        ..moveTo(hip.dx, hip.dy)
        ..lineTo(frontFoot.dx * .6, -unit * .2)
        ..lineTo(frontFoot.dx, frontFoot.dy),
      limb,
    );
    canvas.drawPath(
      Path()
        ..moveTo(hip.dx, hip.dy)
        ..lineTo(backFoot.dx * .6, -unit * .18)
        ..lineTo(backFoot.dx, backFoot.dy),
      limb,
    );
    final jersey = Path()
      ..moveTo(-unit * .19, -unit * .75)
      ..lineTo(unit * .18, -unit * .75)
      ..lineTo(unit * .14, -unit * .38)
      ..lineTo(-unit * .14, -unit * .38)
      ..close();
    canvas.drawPath(jersey, Paint()..color = kit);
    canvas.drawLine(
      Offset(-unit * .12, -unit * .6),
      Offset(unit * .12, -unit * .6),
      Paint()
        ..color = paper.withValues(alpha: .65)
        ..strokeWidth = unit * .055,
    );
    final shoulder = Offset(0, -unit * .7);
    final armY = mix(
      goalkeeper ? -unit * .92 : -unit * .48,
      -unit * 1.08,
      celebrate,
    );
    for (final sign in [-1, 1]) {
      canvas.drawPath(
        Path()
          ..moveTo(shoulder.dx + sign * unit * .14, shoulder.dy)
          ..lineTo(sign * unit * .3, mix(-unit * .62, -unit * .92, celebrate))
          ..lineTo(
            sign * unit * .4,
            armY + (1 - celebrate) * sign * stride * unit * .04,
          ),
        limb..strokeWidth = unit * .075,
      );
    }
    canvas.drawCircle(
      Offset(0, -unit * .9),
      unit * .13,
      Paint()..color = ink.withValues(alpha: .9),
    );
    canvas.drawLine(
      frontFoot,
      frontFoot + Offset(unit * .13, 0),
      limb..strokeWidth = unit * .11,
    );
    canvas.drawLine(backFoot, backFoot + Offset(unit * .13, 0), limb);
    canvas.restore();
  }

  void football(Canvas canvas, double width, double height, Offset position) {
    canvas.save();
    canvas.scale(1 / width, 1 / height);
    canvas.translate(position.dx * width, position.dy * height);
    final radius = math.max(3.0, height * .045);
    canvas.drawOval(
      Rect.fromCenter(
        center: Offset(0, radius * 1.3),
        width: radius * 2.2,
        height: radius * .5,
      ),
      Paint()..color = shadow.withValues(alpha: .12),
    );
    canvas.rotate(frame * .4);
    canvas.drawCircle(Offset.zero, radius, Paint()..color = paper);
    canvas.drawCircle(
      Offset.zero,
      radius,
      Paint()
        ..color = ink
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1,
    );
    final pentagon = Path();
    for (var i = 0; i < 5; i++) {
      final angle = math.pi * 2 * i / 5;
      final point = Offset(math.cos(angle), math.sin(angle)) * radius * .48;
      if (i == 0) {
        pentagon.moveTo(point.dx, point.dy);
      } else {
        pentagon.lineTo(point.dx, point.dy);
      }
      canvas.drawLine(
        point,
        Offset(math.cos(angle), math.sin(angle)) * radius,
        Paint()
          ..color = ink
          ..strokeWidth = .8,
      );
    }
    canvas.drawPath(pentagon..close(), Paint()..color = ink);
    canvas.restore();
  }

  @override
  bool shouldRepaint(FootballPlayPainter oldDelegate) =>
      frame != oldDelegate.frame ||
      field != oldDelegate.field ||
      ink != oldDelegate.ink ||
      shirt != oldDelegate.shirt ||
      paper != oldDelegate.paper ||
      shadow != oldDelegate.shadow;
}

using Microsoft.Graphics.Canvas;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using VelcroPhysics.Dynamics;
using VelcroPhysics.Factories;
using Windows.Foundation;
using Windows.UI;
using MG = Microsoft.Xna.Framework;


namespace SurfacePhysics
{

    public abstract class PhysicsObject
    {
        protected World _world;
        protected Body _body;
        public MG.Vector2 WorldPostition => _body.WorldCenter;

        public PhysicsObject(World world)
        {
            _world = world;
        }
        public abstract void DrawMe(CanvasDrawingSession session, MG.Vector2 originScreenCoordinates, float pixelsPerMeter);

        public void AddVelocity(float x, float y)
        {
            _body.LinearVelocity += new MG.Vector2(x, y);
        }
    }

    public class Ball : PhysicsObject
    {
        float _radius;


        public Ball(World world, float radius, float x, float y): base(world)
        {
            _radius = radius;
            _body = BodyFactory.CreateCircle(
                _world,
                radius,
                1f, // density
                new MG.Vector2(-x, y),
                BodyType.Dynamic);
            _body.Restitution = 0.8f;
            _body.Friction = 0.2f;
        }

        public override void DrawMe(CanvasDrawingSession session, MG.Vector2 originScreenCoordinates, float pixelsPerMeter)
        {
            var circlePosition = _body.WorldCenter * pixelsPerMeter + originScreenCoordinates;
            var circleRadius = _radius * pixelsPerMeter;
            session.DrawCircle(circlePosition.X, circlePosition.Y, circleRadius, Colors.Green);
        }
    }

    public class StickyBlock : PhysicsObject
    {
        float _width, _height;

        public StickyBlock(World world, float width, float height, float x, float y, float rotation) : base(world)
        {
            _width = width;
            _height = height;

            _body = BodyFactory.CreateRectangle(_world, width, height, 1f, new MG.Vector2(x, y));
            _body.BodyType = BodyType.Static;
            _body.Restitution = 0.3f;
            _body.Friction = 0.5f;
        }

        public override void DrawMe(CanvasDrawingSession session, MG.Vector2 originScreenCoordinates, float pixelsPerMeter)
        {
            var groundPosition = _body.WorldCenter * pixelsPerMeter + originScreenCoordinates;
            var groundWidth = _width * pixelsPerMeter;
            var groundHeight = _height * pixelsPerMeter;
            var groundRectangle = new Rect(
                groundPosition.X - groundWidth / 2,
                groundPosition.Y - groundHeight / 2,
                groundWidth,
                groundHeight);
            session.DrawRectangle(groundRectangle, Colors.Brown);
        }
    }
}
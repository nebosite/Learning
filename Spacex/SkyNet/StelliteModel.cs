using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Media;

namespace SkyNet
{
    //-------------------------------------------------------------------------------------
    /// <summary>
    /// SatelliteModel
    /// </summary>
    //-------------------------------------------------------------------------------------
    public class SatelliteModel : BaseModel
    {
        public Vector3 Location { get; set; }
        public Vector3 Velocity { get; set; }
        public Vector3 Acceleration { get; set; }
        public UIElement VisualElement { get; set; }

        public double Size { get; set; }
        public double VisualSize
        {
            get
            {
                var output = Size * ParentModel.Scale;
                if (output < 4) output = 4;
                return output;
            }
        }

        public Brush FillColor { get; set; }
        public MainModel ParentModel { get; set; }

        public double X { get { return ParentModel.CenterX + Location.X * ParentModel.Scale - VisualSize / 2; } }
        public double Y { get { return ParentModel.CenterY + Location.Y * ParentModel.Scale - VisualSize / 2; } }
        public System.Windows.Media.Media3D.GeometryModel3D Model { get; set; }

        //-------------------------------------------------------------------------------------
        /// <summary>
        /// Constructor
        /// </summary>
        //-------------------------------------------------------------------------------------
        public SatelliteModel()
        {
            FillColor = Brushes.White;
        }

        //-------------------------------------------------------------------------------------
        /// <summary>
        /// Move
        /// </summary>
        //-------------------------------------------------------------------------------------
        internal void Move(double timeStep)
        {
            Location += Velocity * timeStep;

            var distanceSquared = Location.LengthSquared;
            if (distanceSquared > 0)
            {
                Velocity += (-PhysicalConstants.GM_EARTH * Location.Normalized) / (distanceSquared) * timeStep;
            }
        }

        //-------------------------------------------------------------------------------------
        /// <summary>
        /// Clone
        /// </summary>
        //-------------------------------------------------------------------------------------
        public SatelliteModel Clone()
        {
            var newModel = new SatelliteModel();
            newModel.Location = Location;
            newModel.Velocity = Velocity;
            newModel.Acceleration = Acceleration;
            newModel.Size = Size;
            newModel.ParentModel = ParentModel;

            return newModel;
        }

    }

}

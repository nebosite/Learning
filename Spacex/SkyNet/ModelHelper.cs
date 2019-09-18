using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Media;
using System.Windows.Media.Media3D;

namespace SkyNet
{
    static class ModelHelper
    {
        //-------------------------------------------------------------------------------------
        /// <summary>
        /// CreateSphereModel
        /// </summary>
        //-------------------------------------------------------------------------------------
        public static GeometryModel3D CreateSphereModel(double targetRadius)
        {
            var model = new GeometryModel3D();
            var mesh = new MeshGeometry3D();

            int latitudes = 40;
            double phiStep = Math.PI / latitudes;
            int segments = 40;
            double thetaStep = Math.PI * 2 / segments;

            for (int j = 0; j <= latitudes; j++)
            {
                double phi = Math.PI / 2 - phiStep * j;
                double y = Math.Sin(phi) * targetRadius;
                double radius = targetRadius * Math.Cos(phi);

                for (int i = 0; i <= segments; i++)
                {
                    var theta = i * thetaStep;
                    var newPosition = new Point3D(radius * Math.Cos(theta), y, radius * Math.Sin(theta));
                    mesh.Positions.Add(newPosition);
                    //mesh.Normals.Add(new Vector3D(newPosition.X, newPosition.Y, newPosition.Z));
                    var textureX = ((segments) - i) / (double)(segments) * .999;
                    var textureY = j / (double)latitudes * .999;
                    mesh.TextureCoordinates.Add(new Point(textureX, textureY));
                }
            }

            int pointsPerLatitude = segments + 1;
            for (int j = 1; j <= latitudes; j++)
            {
                for (int i = 0; i < segments; i++)
                {
                    var p0 = j * pointsPerLatitude + i;
                    var p1 = (j - 1) * pointsPerLatitude + i;
                    var p2 = j * pointsPerLatitude + i + 1;
                    var p3 = (j - 1) * pointsPerLatitude + i + 1;

                    mesh.TriangleIndices.Add(p0);
                    mesh.TriangleIndices.Add(p1);
                    mesh.TriangleIndices.Add(p2);

                    mesh.TriangleIndices.Add(p3);
                    mesh.TriangleIndices.Add(p2);
                    mesh.TriangleIndices.Add(p1);
                }
            }
            model.Geometry = mesh;
            return model;
        }

        //-------------------------------------------------------------------------------------
        /// <summary>
        /// CreateSatelliteModel
        /// </summary>
        //-------------------------------------------------------------------------------------
        public static GeometryModel3D CreateSatelliteModel(Model3DGroup group)
        {
            var model2 = new GeometryModel3D();
            var mesh2 = new MeshGeometry3D();

            mesh2.Positions.Add(new Point3D(0, 0, -.1));
            mesh2.Positions.Add(new Point3D(-.1, 0, .1));
            mesh2.Positions.Add(new Point3D(.1, 0, .1));
            mesh2.Positions.Add(new Point3D(0, .1, 0));
            mesh2.TriangleIndices.Add(0);
            mesh2.TriangleIndices.Add(1);
            mesh2.TriangleIndices.Add(2);

            mesh2.TriangleIndices.Add(0);
            mesh2.TriangleIndices.Add(3);
            mesh2.TriangleIndices.Add(1);

            mesh2.TriangleIndices.Add(3);
            mesh2.TriangleIndices.Add(2);
            mesh2.TriangleIndices.Add(1);

            mesh2.TriangleIndices.Add(1);
            mesh2.TriangleIndices.Add(1);
            mesh2.TriangleIndices.Add(3);

            model2.Geometry = mesh2;

            return model2;
        }
    }
}

FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS base
WORKDIR /app
EXPOSE 8080

FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY ["NurseGo.API.csproj", "."]
RUN dotnet restore
COPY . .
RUN dotnet publish -c Release -o /app/publish --no-restore

FROM base AS final
WORKDIR /app
COPY --from=build /app/publish .

# uploads საქაღალდე
RUN mkdir -p /app/wwwroot/uploads/docs /app/wwwroot/uploads/photos

ENV ASPNETCORE_URLS=http://+:8080
ENTRYPOINT ["dotnet", "NurseGo.API.dll"]
